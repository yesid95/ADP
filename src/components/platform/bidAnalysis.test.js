import { describe, expect, it } from "vitest";
import { analyzeBids, buildAwardWhatsAppUrl, recommendationText } from "./bidAnalysis.js";

const listing = {
  estimatedQuantityKg: "2500.000",
  cropVariety: { name: "Plátano hartón" },
  farm: { name: "Finca El Morichal" }
};

function bid(id, label, overrides = {}) {
  return {
    id,
    anonymousLabel: label,
    status: "SUBMITTED",
    terms: {
      unitPriceCopPerKg: "1800.00",
      offeredQuantityKg: "2500.000",
      transportIncluded: true,
      pickupAtFarm: true,
      sellerLogisticsCostCop: "0.00",
      advanceAmountCop: "500000.00",
      paymentTermDays: 3,
      continuityMonths: null,
      netAmountCop: "4500000.00",
      ...overrides
    }
  };
}

describe("analyzeBids", () => {
  it("recommends the strongest overall commercial conditions", () => {
    const analysis = analyzeBids([
      bid("slow", "A", { unitPriceCopPerKg: "1900.00", netAmountCop: "4750000.00", transportIncluded: false, pickupAtFarm: false, advanceAmountCop: "0.00", paymentTermDays: 30 }),
      bid("balanced", "B", { unitPriceCopPerKg: "1850.00", netAmountCop: "4625000.00", advanceAmountCop: "1200000.00", paymentTermDays: 2 })
    ], listing);

    expect(analysis[0].id).toBe("balanced");
    expect(analysis[0].recommended).toBe(true);
    expect(analysis[0].strengths).toContain("Incluye anticipo");
    expect(analysis[1].warnings).toContain("Transporte no incluido");
    expect(recommendationText(analysis)).toContain("B lidera");
  });

  it("marks partial purchase and seller logistics as risks", () => {
    const [analysis] = analyzeBids([
      bid("partial", "A", { offeredQuantityKg: "1250.000", sellerLogisticsCostCop: "200000.00", netAmountCop: "2050000.00" })
    ], listing);

    expect(analysis.metrics.coverage).toBe(0.5);
    expect(analysis.warnings).toEqual(expect.arrayContaining(["Compra 50% del lote", "Descuenta logística"]));
  });
});

describe("buildAwardWhatsAppUrl", () => {
  it("builds a prefilled message using the revealed phone", () => {
    const url = buildAwardWhatsAppUrl({ businessName: "Comprador Llanero", phone: "+57 310 555 1212" }, listing, bid("winner", "A"));
    expect(url).toContain("https://wa.me/573105551212?text=");
    expect(decodeURIComponent(url)).toContain("Plátano hartón");
  });
});
