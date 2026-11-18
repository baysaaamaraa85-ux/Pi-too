import { Prisma } from "../../generated/prisma/client.js";
import { DomainError } from "../../shared/errors/domain-error.js";

export interface ContractTerms {
  totalHours: Prisma.Decimal;
  price: Prisma.Decimal;
}

// D-96: гэрээний цаг ба үнэ.
// Цаг заагаагүй бол бүтэн багц (settings: 75 академик цаг) бүтэн үнээр.
// Цаг заасан бол (дундаас нь бүртгэх, багцгүй тодорхой цагаар суралцах) үнэ нь
// хөтөлбөрийн үнэ / багцын цаг * заасан цаг. Жишээ: 1 800 000 / 75 * 10 = 240 000.
export function computeContractTerms(
  programPrice: Prisma.Decimal | string,
  packageHours: number,
  requestedHours: number | undefined,
): ContractTerms {
  const price = new Prisma.Decimal(programPrice);
  if (requestedHours === undefined) {
    return { totalHours: new Prisma.Decimal(packageHours), price };
  }

  const hours = new Prisma.Decimal(requestedHours);
  // Хадгалах талбар нь NUMERIC(7,2): хоёроос илүү оронтой цагийг чимээгүй бөөрөнхийлөхгүй, татгалзана.
  if (hours.lte(0) || hours.decimalPlaces() > 2 || hours.gt(packageHours)) {
    throw new DomainError({
      code: "package-hours-out-of-range",
      status: 422,
      title: "Сургалтын цаг буруу байна",
      detail: `Сургалтын цаг 0-ээс их, ${packageHours}-аас хэтрэхгүй, хамгийн ихдээ 2 оронтой бутархай байна.`,
      extra: { requestedHours, maxHours: packageHours },
    });
  }

  return {
    totalHours: hours,
    price: price.times(hours).div(packageHours).toDecimalPlaces(2),
  };
}
