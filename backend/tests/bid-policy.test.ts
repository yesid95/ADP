import { Prisma } from "../src/generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import { AppError } from "../src/shared/errors.js";
import { validateBidTerms } from "../src/modules/bids/bid-policy.js";

const baseTerms = {
  unitPriceCopPerKg: "1800.00",
  offeredQuantityKg: "2500.000",
  transportIncluded: true,
  pickupAtFarm: true,
  sellerLogisticsCostCop: "0.00",
  advanceAmountCop: "1000000.00",
  paymentTermDays: 5
};

function captureAppError(operation: () => unknown): AppError {
  try {
    operation();
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected operation to throw AppError");
}

describe("bid policy", () => {
  it("calculates gross and net values with decimals", () => {
    const result = validateBidTerms(baseTerms, {
      estimatedQuantityKg: new Prisma.Decimal("2500.000"),
      allowsPartialPurchase: false
    });
    expect(result.grossAmountCop.toFixed(2)).toBe("4500000.00");
    expect(result.netAmountCop.toFixed(2)).toBe("4500000.00");
  });

  it("rejects a partial bid when the listing requires the whole lot", () => {
    const error = captureAppError(() =>
      validateBidTerms(
        { ...baseTerms, offeredQuantityKg: "1000.000" },
        {
          estimatedQuantityKg: new Prisma.Decimal("2500.000"),
          allowsPartialPurchase: false
        }
      )
    );
    expect(error.code).toBe("PARTIAL_PURCHASE_FORBIDDEN");
  });

  it("rejects logistics charged to the seller when transport is included", () => {
    const error = captureAppError(() =>
      validateBidTerms(
        { ...baseTerms, sellerLogisticsCostCop: "300000.00" },
        {
          estimatedQuantityKg: new Prisma.Decimal("2500.000"),
          allowsPartialPurchase: true
        }
      )
    );
    expect(error.code).toBe("TRANSPORT_COST_CONFLICT");
  });

  it("rejects an advance larger than the gross amount", () => {
    const error = captureAppError(() =>
      validateBidTerms(
        { ...baseTerms, advanceAmountCop: "5000000.00" },
        {
          estimatedQuantityKg: new Prisma.Decimal("2500.000"),
          allowsPartialPurchase: true
        }
      )
    );
    expect(error.code).toBe("ADVANCE_INVALID");
  });
});
