import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors.js";

export interface BidTermsInput {
  unitPriceCopPerKg: string;
  offeredQuantityKg: string;
  transportIncluded: boolean;
  pickupAtFarm: boolean;
  sellerLogisticsCostCop: string;
  advanceAmountCop: string;
  paymentTermDays: number;
  continuityMonths?: number | undefined;
  continuityNotes?: string | undefined;
  observations?: string | undefined;
}

export interface ListingTermsContext {
  estimatedQuantityKg: Prisma.Decimal;
  allowsPartialPurchase: boolean;
}

export interface ValidatedBidTerms {
  unitPriceCopPerKg: Prisma.Decimal;
  offeredQuantityKg: Prisma.Decimal;
  transportIncluded: boolean;
  pickupAtFarm: boolean;
  sellerLogisticsCostCop: Prisma.Decimal;
  advanceAmountCop: Prisma.Decimal;
  paymentTermDays: number;
  continuityMonths?: number | undefined;
  continuityNotes?: string | undefined;
  observations?: string | undefined;
  grossAmountCop: Prisma.Decimal;
  netAmountCop: Prisma.Decimal;
}

function decimal(value: string, field: string): Prisma.Decimal {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new AppError(422, "DECIMAL_INVALID", field + " is not a valid decimal");
  }
}

export function validateBidTerms(
  input: BidTermsInput,
  listing: ListingTermsContext
): ValidatedBidTerms {
  const price = decimal(input.unitPriceCopPerKg, "unitPriceCopPerKg");
  const quantity = decimal(input.offeredQuantityKg, "offeredQuantityKg");
  const logistics = decimal(input.sellerLogisticsCostCop, "sellerLogisticsCostCop");
  const advance = decimal(input.advanceAmountCop, "advanceAmountCop");

  if (price.lte(0) || quantity.lte(0)) {
    throw new AppError(422, "BID_AMOUNT_INVALID", "Price and quantity must be positive");
  }
  if (quantity.gt(listing.estimatedQuantityKg)) {
    throw new AppError(422, "BID_QUANTITY_INVALID", "The offered quantity exceeds the listing");
  }
  if (!listing.allowsPartialPurchase && !quantity.eq(listing.estimatedQuantityKg)) {
    throw new AppError(422, "PARTIAL_PURCHASE_FORBIDDEN", "This listing requires a full purchase");
  }
  if (logistics.lt(0)) {
    throw new AppError(422, "LOGISTICS_COST_INVALID", "Logistics cost cannot be negative");
  }
  if (input.transportIncluded && !logistics.isZero()) {
    throw new AppError(
      422,
      "TRANSPORT_COST_CONFLICT",
      "Seller logistics cost must be zero when transport is included"
    );
  }

  const grossAmountCop = price.mul(quantity);
  if (advance.lt(0) || advance.gt(grossAmountCop)) {
    throw new AppError(422, "ADVANCE_INVALID", "Advance must be between zero and gross amount");
  }
  if (input.paymentTermDays < 0 || input.paymentTermDays > 365) {
    throw new AppError(422, "PAYMENT_TERM_INVALID", "Payment term must be between 0 and 365 days");
  }
  if (
    input.continuityMonths !== undefined &&
    (input.continuityMonths < 1 || input.continuityMonths > 120)
  ) {
    throw new AppError(422, "CONTINUITY_INVALID", "Continuity must be between 1 and 120 months");
  }
  if (input.continuityMonths !== undefined && !input.continuityNotes?.trim()) {
    throw new AppError(422, "CONTINUITY_NOTES_REQUIRED", "Continuity notes are required");
  }

  return {
    unitPriceCopPerKg: price,
    offeredQuantityKg: quantity,
    transportIncluded: input.transportIncluded,
    pickupAtFarm: input.pickupAtFarm,
    sellerLogisticsCostCop: logistics,
    advanceAmountCop: advance,
    paymentTermDays: input.paymentTermDays,
    continuityMonths: input.continuityMonths,
    continuityNotes: input.continuityNotes?.trim(),
    observations: input.observations?.trim(),
    grossAmountCop,
    netAmountCop: grossAmountCop.minus(logistics)
  };
}
