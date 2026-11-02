import type { TransferContractInput, TransferResultDto } from "@pitoo/contracts";
import { ContractStatus } from "../../generated/prisma/client.js";
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

// ФШ-71: гэрээг өөр анги (салбар, багш) руу шилжүүлнэ. Нэг транзакц: хуучин бүртгэлийг
// (effectiveFrom - 1)-ээр хааж, шинэ бүртгэлийг effectiveFrom-оос нээнэ. Гэрээний үлдэгдэл,
// чөлөөний эрх, дүнгийн түүх гэрээ/сурагчид хамаарах тул хэвээр. Өмнөх ирц, цалингийн мөр
// (ledger_entries) хуучин багшийн нэр дээр хэвээр, зөвхөн ирээдүйн хичээл шинэ ангид орно.
export function transferContract(
  actorId: string,
  contractId: string,
  input: TransferContractInput,
): Promise<TransferResultDto> {
  return prisma.$transaction(async (tx) => {
    const contract = await lockContractInTx(tx, contractId);
    if (contract.status !== ContractStatus.ACTIVE) {
      conflict("contract-not-active", "Гэрээ идэвхтэй биш", "Зөвхөн идэвхтэй гэрээг шилжүүлнэ.");
    }
    if (input.fromClassId === input.toClassId) {
      conflict("transfer-same-class", "Ижил анги сонгосон", "Шинэ анги одоогийн ангиас өөр байх ёстой.");
    }

    // Өнгөрсөн цалин, ирцийг хөндөхгүйн тулд зөвхөн өнөөдөр болон дараах өдрөөс шилжинэ.
    const effective = new Date(`${input.effectiveFrom}T00:00:00Z`);
    if (effective.getTime() < todayInUlaanbaatar().getTime()) {
      conflict(
        "transfer-date-in-past",
        "Шилжилтийн огноо өнгөрсөн",
        "Шилжилт өнөөдөр болон дараагийн өдрөөс эхэлнэ.",
      );
    }

    const active = await getActiveEnrollmentsWithClassInTx(tx, contractId);
    const old = active.find((e) => e.classId === input.fromClassId);
    if (!old) {
      conflict("transfer-not-enrolled", "Бүртгэл олдсонгүй", "Гэрээ сонгосон ангид бүртгэлгүй байна.");
    }
    if (active.some((e) => e.classId === input.toClassId)) {
      conflict("transfer-already-enrolled", "Аль хэдийн бүртгэлтэй", "Гэрээ шинэ ангид бүртгэлтэй байна.");
    }
    if (effective.getTime() <= old.fromDate.getTime()) {
      conflict(
        "transfer-date-before-enrollment",
        "Шилжилтийн огноо эрт байна",
        "Шилжилтийн огноо хуучин бүртгэлийн эхлэх огнооноос хойш байх ёстой.",
      );
    }

    const target = await getClassInTx(tx, input.toClassId);
    if (!target.isActive) {
      conflict("transfer-class-inactive", "Анги идэвхгүй", "Идэвхгүй анги руу шилжүүлэх боломжгүй.");
    }

    await closeEnrollmentInTx(tx, old.id, new Date(effective.getTime() - DAY_MS));
    // 6 суудлын хязгаар (ФШ-20) энд шалгагдаж, дүүрсэн бол 409-өөр бүх өөрчлөлт буцна.
    await enrollContractInClassInTx(tx, contractId, input.toClassId, effective);

    await writeAudit(tx, {
      entity: "contract",
      entityId: contractId,
      action: "TRANSFER",
      before: { classId: old.classId, branchId: old.class.branchId, teacherId: old.class.teacherId },
      after: {
        classId: target.id,
        branchId: target.branchId,
        teacherId: target.teacherId,
        effectiveFrom: input.effectiveFrom,
      },
      reason: input.reason,
      actorId,
    });

    return {
      contractId,
      fromClassId: input.fromClassId,
      toClassId: input.toClassId,
      effectiveFrom: input.effectiveFrom,
      remainingVisits: contract.remainingVisits,
      leavesLeft: contract.leavesLeft,
    };
  });
}
