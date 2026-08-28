import { useCallback, useEffect, useState } from "react";
import { idempotencyKey } from "../../lib/api.js";
import { FormStatus, ListingCard } from "./shared.jsx";
import { errorMessage, money } from "./utils.js";

export function BuyerWorkspace({ client, publicListings, reloadPublicListings }) {
  const [ownBids, setOwnBids] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState({ unitPriceCopPerKg: "1850.00", offeredQuantityKg: "2500.000", advanceAmountCop: "0.00", paymentTermDays: 3 });

  const loadBids = useCallback(async () => {
    const page = await client.request("/me/bids?limit=100");
    setOwnBids(page.data);
  }, [client]);

  const load = useCallback(async () => {
    await Promise.all([loadBids(), reloadPublicListings()]);
  }, [loadBids, reloadPublicListings]);

  useEffect(() => { load().catch((loadError) => setError(errorMessage(loadError))); }, [load]);

  async function submitBid(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await client.request(`/listings/${selected.id}/bids`, {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey("bid") },
        body: {
          unitPriceCopPerKg: terms.unitPriceCopPerKg,
          offeredQuantityKg: terms.offeredQuantityKg,
          transportIncluded: true,
          pickupAtFarm: true,
          sellerLogisticsCostCop: "0.00",
          advanceAmountCop: terms.advanceAmountCop,
          paymentTermDays: Number(terms.paymentTermDays)
        }
      });
      setNotice("Oferta enviada. Tu identidad permanece oculta para el productor.");
      setSelected(null);
      await Promise.all([loadBids(), reloadPublicListings()]);
    } catch (bidError) { setError(errorMessage(bidError)); }
    finally { setBusy(false); }
  }

  async function withdraw(bidId) {
    setBusy(true); setError("");
    try {
      await client.request(`/bids/${bidId}/withdraw`, {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey("withdraw") }
      });
      setNotice("Oferta retirada y conservada en el historial.");
      await loadBids();
    } catch (withdrawError) { setError(errorMessage(withdrawError)); }
    finally { setBusy(false); }
  }

  return (
    <div className="platform-columns">
      <section className="panel">
        <div className="panel-heading"><h2>Mercado abierto</h2><span className="pill">{publicListings.length} cosechas</span></div>
        <FormStatus error={error} notice={notice} />
        <div className="platform-records">
          {publicListings.map((listing) => <ListingCard key={listing.id} listing={listing} actions={<button className="primary-button compact-button" onClick={() => { setSelected(listing); setTerms((current) => ({ ...current, offeredQuantityKg: listing.estimatedQuantityKg })); }} type="button">Presentar oferta</button>} />)}
          {!publicListings.length && <p className="helper-copy">No hay cosechas abiertas en este momento.</p>}
        </div>
      </section>
      <section className="platform-stack">
        {selected && (
          <form className="panel platform-form" onSubmit={submitBid}>
            <h2>Oferta para {selected.farm.name}</h2>
            <label className="form-field">Precio COP/kg<input required value={terms.unitPriceCopPerKg} onChange={(event) => setTerms({ ...terms, unitPriceCopPerKg: event.target.value })} /></label>
            <label className="form-field">Cantidad kg<input required value={terms.offeredQuantityKg} onChange={(event) => setTerms({ ...terms, offeredQuantityKg: event.target.value })} /></label>
            <label className="form-field">Anticipo COP<input required value={terms.advanceAmountCop} onChange={(event) => setTerms({ ...terms, advanceAmountCop: event.target.value })} /></label>
            <label className="form-field">Plazo de pago (días)<input required min="0" max="365" type="number" value={terms.paymentTermDays} onChange={(event) => setTerms({ ...terms, paymentTermDays: event.target.value })} /></label>
            <div className="button-row"><button className="primary-button" disabled={busy} type="submit">Enviar oferta</button><button className="secondary-button" onClick={() => setSelected(null)} type="button">Cancelar</button></div>
          </form>
        )}
        <div className="panel">
          <div className="panel-heading"><h2>Mis ofertas</h2><button className="secondary-button compact-button" onClick={() => load().catch((loadError) => setError(errorMessage(loadError)))} type="button">Actualizar</button></div>
          <div className="platform-records">
            {ownBids.map((bid) => (
              <article className="platform-record" key={bid.id}>
                <span className="pill">{bid.status}</span><h3>{bid.listing.cropVariety.name}</h3>
                <p>{bid.listing.farm.name} · {money.format(Number(bid.currentVersion?.netAmountCop || 0))}</p>
                {bid.status === "SUBMITTED" && <button className="secondary-button compact-button" disabled={busy} onClick={() => withdraw(bid.id)} type="button">Retirar</button>}
              </article>
            ))}
            {!ownBids.length && <p className="helper-copy">Aún no has presentado ofertas.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
