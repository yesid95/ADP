function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) < 0.01;
}

export function analyzeBids(bids, listing) {
  if (!listing || !bids.length) return [];

  const listingQuantity = Math.max(numeric(listing.estimatedQuantityKg), 1);
  const candidates = bids.map((bid) => {
    const terms = bid.terms;
    const netAmount = numeric(terms.netAmountCop);
    const offeredQuantity = numeric(terms.offeredQuantityKg);
    const advanceAmount = numeric(terms.advanceAmountCop);
    const paymentDays = numeric(terms.paymentTermDays);
    const coverage = Math.min(offeredQuantity / listingQuantity, 1);
    const advanceRatio = netAmount > 0 ? Math.min(advanceAmount / netAmount, 1) : 0;
    const paymentSpeed = Math.max(0, 1 - paymentDays / 30);
    const logisticsScore = terms.transportIncluded && terms.pickupAtFarm ? 1 : 0;

    return {
      ...bid,
      metrics: { netAmount, offeredQuantity, advanceAmount, paymentDays, coverage },
      score: netAmount * 0.5 + coverage * listingQuantity * numeric(terms.unitPriceCopPerKg) * 0.2
        + logisticsScore * netAmount * 0.1 + advanceRatio * netAmount * 0.1
        + paymentSpeed * netAmount * 0.1
    };
  });

  const maxNet = Math.max(...candidates.map((bid) => bid.metrics.netAmount));
  const ranked = [...candidates].sort((left, right) => right.score - left.score);

  return ranked.map((bid, index) => {
    const strengths = [];
    const warnings = [];
    const { terms, metrics } = bid;

    if (nearlyEqual(metrics.netAmount, maxNet)) strengths.push("Mayor valor neto");
    if (metrics.coverage >= 0.999) strengths.push("Compra toda la cosecha");
    if (terms.transportIncluded && terms.pickupAtFarm) strengths.push("Recoge en finca");
    if (metrics.advanceAmount > 0) strengths.push("Incluye anticipo");
    if (metrics.paymentDays <= 3) strengths.push("Pago rápido");
    if (numeric(terms.continuityMonths) > 0) strengths.push("Propone continuidad");

    if (metrics.coverage < 0.999) warnings.push(`Compra ${Math.round(metrics.coverage * 100)}% del lote`);
    if (numeric(terms.sellerLogisticsCostCop) > 0) warnings.push("Descuenta logística");
    if (!terms.transportIncluded) warnings.push("Transporte no incluido");
    if (metrics.paymentDays > 7) warnings.push(`Pago a ${metrics.paymentDays} días`);
    if (metrics.advanceAmount === 0) warnings.push("Sin anticipo");

    return { ...bid, rank: index + 1, recommended: index === 0, strengths, warnings };
  });
}

export function recommendationText(analysis) {
  const recommended = analysis[0];
  if (!recommended) return "Aún no hay ofertas suficientes para analizar.";
  const reasons = recommended.strengths.slice(0, 3);
  return reasons.length
    ? `${recommended.anonymousLabel} lidera por ${reasons.join(", ").toLowerCase()}.`
    : `${recommended.anonymousLabel} ofrece el mejor balance entre ingreso y condiciones de pago.`;
}

export function buildAwardWhatsAppUrl(winner, listing, bid) {
  const buyerName = winner.businessName || winner.displayName || "equipo comprador";
  const crop = listing.cropVariety?.name || "la cosecha publicada";
  const message = `Hola, ${buyerName}. Confirmamos la adjudicación de ${crop} de ${listing.farm?.name || "nuestra finca"} por ${bid.terms.offeredQuantityKg} kg. Coordinemos recogida, pago y cierre de la negociación.`;
  const phone = String(winner.phone || "").replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
