import type { TransferContractInput, TransferManyInput, TransferResultDto } from "@pitoo/contracts";
import { ContractStatus, Role } from "../../generated/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { lockContractInTx } from "../enrollment/enrollment.service.js";
import {
  closeEnrollmentInTx,
  enrollContractInClassInTx,
  getActiveEnrollmentsWithClassInTx,
  getClassInTx,
  todayInUlaanbaatar,
} from "../scheduling/scheduling.service.js";

const DAY_MS = 86_400_000;

function conflict(code: string, title: string, detail: string): never {
  throw new DomainError({ code, status: 409, title, detail });
}

type Tx = Prisma.TransactionClient;
type Actor = { id: string; role: Role };
type Move = { fromClassId: string; toClassId: string };

// Нэг ангиас нөгөөд шилжүүлэх цөм: хуучин бүртгэлийг (effectiveFrom - 1)-ээр хааж, шинэ бүртгэлийг
// effectiveFrom-оос нээнэ. Дуудагч транзакц нээж, гэрээг түгжсэн байна (design 8.2).
async function moveOneInTx(
  tx: Tx,
  actor: Actor,
  contractId: string,
  move: Move,
  effectiveFrom: string,
  reason: string,
): Promise<void> {
  if (move.fromClassId === move.toClassId) {
    conflict("transfer-same-class", "Ижил анги сонгосон", "Шинэ анги одоогийн ангиас өөр байх ёстой.");
  }

  // Өнгөрсөн цалин, ирцийг хөндөхгүйн тулд зөвхөн өнөөдөр болон дараах өдрөөс шилжинэ.
  const effective = new Date(`${effectiveFrom}T00:00:00Z`);
  if (effective.getTime() < todayInUlaanbaatar().getTime()) {
    conflict(
      "transfer-date-in-past",
      "Шилжилтийн огноо өнгөрсөн",
      "Шилжилт өнөөдөр болон дараагийн өдрөөс эхэлнэ.",
    );
  }

  const active = await getActiveEnrollmentsWithClassInTx(tx, contractId);
  const old = active.find((e) => e.classId === move.fromClassId);
  if (!old) {
    conflict("transfer-not-enrolled", "Бүртгэл олдсонгүй", "Гэрээ сонгосон ангид бүртгэлгүй байна.");
  }
  // D-69: багш зөвхөн өөрийн ангиас сурагчаа зөөнө (анги устгахаас өмнө), ADR-008.
  if (actor.role === Role.TEACHER && old.class.teacherId !== actor.id) {
    throw new DomainError({
      code: "forbidden-transfer",
      status: 403,
      title: "Эрх хүрэхгүй байна",
      detail: "Та зөвхөн өөрийн ангиас сурагч зөөнө.",
    });
  }
  if (active.some((e) => e.classId === move.toClassId)) {
    conflict("transfer-already-enrolled", "Аль хэдийн бүртгэлтэй", "Гэрээ шинэ ангид бүртгэлтэй байна.");
  }
  if (effective.getTime() <= old.fromDate.getTime()) {
    conflict(
      "transfer-date-before-enrollment",
      "Шилжилтийн огноо эрт байна",
      "Шилжилтийн огноо хуучин бүртгэлийн эхлэх огнооноос хойш байх ёстой.",
    );
  }

  const target = await getClassInTx(tx, move.toClassId);
  if (!target.isActive) {
    conflict("transfer-class-inactive", "Анги идэвхгүй", "Идэвхгүй анги руу шилжүүлэх боломжгүй.");
  }

  await closeEnrollmentInTx(tx, old.id, new Date(effective.getTime() - DAY_MS));
  // 6 суудлын хязгаар (ФШ-20) энд шалгагдаж, дүүрсэн бол 409-өөр бүх өөрчлөлт буцна.
  await enrollContractInClassInTx(tx, contractId, move.toClassId, effective);

  await writeAudit(tx, {
    entity: "contract",
    entityId: contractId,
    action: "TRANSFER",
    before: { classId: old.classId, branchId: old.class.branchId, teacherId: old.class.teacherId },
    after: {
      classId: target.id,
      branchId: target.branchId,
      teacherId: target.teacherId,
      effectiveFrom,
    },
    reason,
    actorId: actor.id,
  });
}

// ФШ-71: гэрээг өөр анги (салбар, багш) руу шилжүүлнэ. Нэг транзакц. Гэрээний үлдэгдэл,
// чөлөөний эрх, дүнгийн түүх гэрээ/сурагчид хамаарах тул хэвээр. Өмнөх ирц, цалингийн мөр
// (ledger_entries) хуучин багшийн нэр дээр хэвээр, зөвхөн ирээдүйн хичээл шинэ ангид орно.
export function transferContract(
  actor: Actor,
  contractId: string,
  input: TransferContractInput,
): Promise<TransferResultDto> {
  return prisma.$transaction(async (tx) => {
    const contract = await lockContractInTx(tx, contractId);
    if (contract.status !== ContractStatus.ACTIVE) {
      conflict("contract-not-active", "Гэрээ идэвхтэй биш", "Зөвхөн идэвхтэй гэрээг шилжүүлнэ.");
    }
    await moveOneInTx(tx, actor, contractId, input, input.effectiveFrom, input.reason);
    return {
      contractId,
      fromClassId: input.fromClassId,
      toClassId: input.toClassId,
      effectiveFrom: input.effectiveFrom,
      remainingHours: contract.remainingHours.toNumber(),
      leavesLeft: contract.leavesLeft,
    };
  });
}

// D-73: сурагчийн хэд хэдэн ангийг нэг дор шилжүүлнэ. Бүгд нэг транзакцад: нэг нь амжилтгүй бол
// бүх шилжилт буцна (хагас шилжсэн сурагч үүсэхгүй). Ижил дүрмүүд (эзэмшил, огноо, 6 суудал) анги бүрт.
export function transferContractMany(
  actor: Actor,
  contractId: string,
  input: TransferManyInput,
): Promise<TransferResultDto[]> {
  return prisma.$transaction(async (tx) => {
    const contract = await lockContractInTx(tx, contractId);
    if (contract.status !== ContractStatus.ACTIVE) {
      conflict("contract-not-active", "Гэрээ идэвхтэй биш", "Зөвхөн идэвхтэй гэрээг шилжүүлнэ.");
    }
    for (const move of input.moves) {
      await moveOneInTx(tx, actor, contractId, move, input.effectiveFrom, input.reason);
    }
    return input.moves.map((m) => ({
      contractId,
      fromClassId: m.fromClassId,
      toClassId: m.toClassId,
      effectiveFrom: input.effectiveFrom,
      remainingHours: contract.remainingHours.toNumber(),
      leavesLeft: contract.leavesLeft,
    }));
  });
}
