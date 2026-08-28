import { AlertTriangle, Check, MessageCircle, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { analyzeBids, buildAwardWhatsAppUrl, recommendationText } from "./bidAnalysis.js";
import { money } from "./utils.js";

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

export function BidComparison({ bids, busy, listing, onAward, pendingBidId, setPendingBidId, winner }) {
  const analysis = analyzeBids(bids, listing);
  const pendingBid = analysis.find((bid) => bid.id === pendingBidId);
  const awardedBid = analysis.find((bid) => bid.status === "ACCEPTED");

  if (!analysis.length) {
    return <div className="decision-empty"><Sparkles size={22} /><p>Cuando llegue la primera oferta, el asistente comparará ingreso neto, cobertura, logística, anticipo y plazo de pago.</p></div>;
  }

  return (
    <div className="decision-assistant">
      <div className="decision-summary">
        <div className="decision-summary-icon"><Sparkles aria-hidden="true" size={24} /></div>
        <div><span>Asistente de decisión</span><h3>{recommendationText(analysis)}</h3><p>Análisis explicable basado únicamente en las condiciones registradas por los compradores.</p></div>
        <span className="decision-count">{analysis.length} oferta{analysis.length === 1 ? "" : "s"}</span>
      </div>

      <div className="bid-comparison-grid">
        {analysis.map((bid) => (
          <article className={`bid-comparison-card${bid.recommended ? " recommended" : ""}`} key={bid.id}>
            <div className="bid-card-top">
              <div className="anonymous-buyer"><span>{bid.anonymousLabel}</span><div><small>Comprador anónimo</small><h3>Oferta {bid.anonymousLabel}</h3></div></div>
              {bid.recommended && <span className="recommended-badge"><Sparkles size={14} /> Recomendada</span>}
            </div>
            <div className="net-value"><small>Recibes neto</small><strong>{money.format(bid.metrics.netAmount)}</strong><span>{money.format(Number(bid.terms.unitPriceCopPerKg))} por kg</span></div>
            <dl className="bid-metrics">
              <div><dt>Cobertura</dt><dd>{percent(bid.metrics.coverage)}</dd></div>
              <div><dt>Anticipo</dt><dd>{money.format(bid.metrics.advanceAmount)}</dd></div>
              <div><dt>Pago</dt><dd>{bid.metrics.paymentDays} días</dd></div>
              <div><dt>Logística</dt><dd>{bid.terms.transportIncluded ? "Incluida" : "No incluida"}</dd></div>
            </dl>
            <div className="bid-signals">
              {bid.strengths.map((strength) => <span className="signal positive" key={strength}><Check size={13} />{strength}</span>)}
              {bid.warnings.map((warning) => <span className="signal warning" key={warning}><AlertTriangle size={13} />{warning}</span>)}
            </div>
            {bid.status === "SUBMITTED" && <button className={bid.recommended ? "primary-button" : "secondary-button"} disabled={busy} onClick={() => setPendingBidId(bid.id)} type="button">Revisar y adjudicar</button>}
            {bid.status === "ACCEPTED" && <div className="accepted-label"><ShieldCheck size={16} /> Oferta adjudicada</div>}
          </article>
        ))}
      </div>

      {pendingBid && (
        <div className="award-confirmation" role="alertdialog" aria-labelledby="award-confirmation-title">
          <div><span>Confirmación comercial</span><h3 id="award-confirmation-title">¿Adjudicar a la oferta {pendingBid.anonymousLabel}?</h3><p>Recibirías {money.format(pendingBid.metrics.netAmount)} netos. La publicación se cerrará y solo entonces se revelará la identidad del comprador.</p></div>
          <div className="button-row"><button className="primary-button" disabled={busy} onClick={() => onAward(pendingBid.id)} type="button">Sí, adjudicar</button><button className="secondary-button" disabled={busy} onClick={() => setPendingBidId(null)} type="button">Volver a comparar</button></div>
        </div>
      )}

      {winner && awardedBid && (
        <div className="winner-reveal enhanced">
          <div className="winner-icon"><ShieldCheck size={26} /></div>
          <div><span>Negociación adjudicada</span><h3>{winner.businessName || winner.displayName}</h3><p>La identidad se reveló después de aceptar la oferta. El evento quedó registrado en la auditoría.</p><div className="winner-contact"><span>{winner.email}</span><span>{winner.phone || "Teléfono no registrado"}</span></div></div>
          <a className="whatsapp-button" href={buildAwardWhatsAppUrl(winner, listing, awardedBid)} rel="noreferrer" target="_blank"><MessageCircle size={18} /> Cerrar por WhatsApp</a>
        </div>
      )}

      <p className="decision-footnote"><Truck size={15} /> La recomendación considera valor neto, cobertura del lote, transporte, anticipo y rapidez del pago.</p>
    </div>
  );
}
