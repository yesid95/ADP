import { useCallback, useEffect, useState } from "react";
import { idempotencyKey } from "../../lib/api.js";
import { FormStatus, ListingCard } from "./shared.jsx";
import { errorMessage, isoDate, money } from "./utils.js";

export function FarmerWorkspace({ client, catalog }) {
  const [farms, setFarms] = useState([]);
  const [listings, setListings] = useState([]);
  const [bids, setBids] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const municipalities = catalog.departments.flatMap((department) => department.municipalities);
  const [farm, setFarm] = useState({ municipalityId: "", name: "", vereda: "", publicLocationText: "" });
  const [listing, setListing] = useState({
    farmId: "",
    cropVarietyId: "",
    estimatedQuantityKg: "2500.000",
    availableFromDate: isoDate(2),
    expectedPriceCopPerKg: "1800.00",
    bidDeadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString().slice(0, 16),
    cropConditionNotes: "",
    photo: null
  });

  const load = useCallback(async () => {
    const [farmPage, listingPage] = await Promise.all([
      client.request("/farms?limit=100"),
      client.request("/me/listings?limit=100")
    ]);
    setFarms(farmPage.data);
    setListings(listingPage.data);
  }, [client]);

  useEffect(() => {
    load().catch((loadError) => setError(errorMessage(loadError)));
  }, [load]);

  async function createFarm(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await client.request("/farms", {
        method: "POST",
        body: { ...farm, municipalityId: Number(farm.municipalityId) }
      });
      setListing((current) => ({ ...current, farmId: response.data.id }));
      setFarm({ municipalityId: "", name: "", vereda: "", publicLocationText: "" });
      setNotice("Finca creada. Ya puedes publicar una cosecha.");
      await load();
    } catch (farmError) { setError(errorMessage(farmError)); }
    finally { setBusy(false); }
  }

  async function createListing(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await client.request("/listings", {
        method: "POST",
        body: {
          farmId: listing.farmId,
          cropVarietyId: Number(listing.cropVarietyId),
          estimatedQuantityKg: listing.estimatedQuantityKg,
          availableFromDate: listing.availableFromDate,
          expectedPriceCopPerKg: listing.expectedPriceCopPerKg,
          cropConditionNotes: listing.cropConditionNotes || undefined,
          allowsPartialPurchase: false,
          bidDeadlineAt: new Date(listing.bidDeadlineAt).toISOString()
        }
      });
      if (listing.photo) {
        await client.request(`/listings/${created.data.id}/photos`, {
          method: "POST",
          headers: { "content-type": listing.photo.type, "x-sort-order": "0" },
          body: listing.photo
        });
      }
      await client.request(`/listings/${created.data.id}/publish`, { method: "POST" });
      setNotice("Cosecha publicada y visible para compradores.");
      setListing((current) => ({ ...current, cropConditionNotes: "", photo: null }));
      await load();
    } catch (listingError) { setError(errorMessage(listingError)); }
    finally { setBusy(false); }
  }

  async function loadBids(listingId) {
    setError(""); setWinner(null); setSelectedListingId(listingId);
    try {
      const response = await client.request(`/listings/${listingId}/bids`);
      setBids(response.data);
    } catch (bidError) { setError(errorMessage(bidError)); }
  }

  async function award(bidId) {
    setBusy(true); setError("");
    try {
      await client.request(`/listings/${selectedListingId}/award`, {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey("award") },
        body: { bidId }
      });
      const contact = await client.request(`/listings/${selectedListingId}/award/contact`);
      setWinner(contact.data);
      setNotice("Oferta adjudicada. La identidad del ganador quedó habilitada.");
      await Promise.all([load(), loadBids(selectedListingId)]);
    } catch (awardError) { setError(errorMessage(awardError)); }
    finally { setBusy(false); }
  }

  return (
    <div className="platform-columns">
      <section className="platform-stack">
        <form className="panel platform-form" onSubmit={createFarm}>
          <div className="panel-heading"><h2>1. Registrar finca</h2><span className="pill">{farms.length} fincas</span></div>
          <label className="form-field">Municipio<select required value={farm.municipalityId} onChange={(event) => setFarm({ ...farm, municipalityId: event.target.value })}><option value="">Selecciona</option>{municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name}</option>)}</select></label>
          <div className="form-grid">
            <label className="form-field">Nombre<input required value={farm.name} onChange={(event) => setFarm({ ...farm, name: event.target.value })} /></label>
            <label className="form-field">Vereda<input required value={farm.vereda} onChange={(event) => setFarm({ ...farm, vereda: event.target.value })} /></label>
          </div>
          <label className="form-field">Ubicación pública<input required value={farm.publicLocationText} onChange={(event) => setFarm({ ...farm, publicLocationText: event.target.value })} /></label>
          <button className="primary-button" disabled={busy} type="submit">Guardar finca</button>
        </form>

        <form className="panel platform-form" onSubmit={createListing}>
          <div className="panel-heading"><h2>2. Publicar cosecha</h2><span className="pill">Persistente</span></div>
          <label className="form-field">Finca<select required value={listing.farmId} onChange={(event) => setListing({ ...listing, farmId: event.target.value })}><option value="">Selecciona</option>{farms.filter((item) => item.status !== "ARCHIVED").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="form-field">Cultivo<select required value={listing.cropVarietyId} onChange={(event) => setListing({ ...listing, cropVarietyId: event.target.value })}><option value="">Selecciona</option>{catalog.crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></label>
          <div className="form-grid">
            <label className="form-field">Cantidad kg<input required inputMode="decimal" value={listing.estimatedQuantityKg} onChange={(event) => setListing({ ...listing, estimatedQuantityKg: event.target.value })} /></label>
            <label className="form-field">Precio COP/kg<input required inputMode="decimal" value={listing.expectedPriceCopPerKg} onChange={(event) => setListing({ ...listing, expectedPriceCopPerKg: event.target.value })} /></label>
            <label className="form-field">Disponible desde<input required type="date" value={listing.availableFromDate} onChange={(event) => setListing({ ...listing, availableFromDate: event.target.value })} /></label>
            <label className="form-field">Cierre de ofertas<input required type="datetime-local" value={listing.bidDeadlineAt} onChange={(event) => setListing({ ...listing, bidDeadlineAt: event.target.value })} /></label>
          </div>
          <label className="form-field">Notas<textarea value={listing.cropConditionNotes} onChange={(event) => setListing({ ...listing, cropConditionNotes: event.target.value })} /></label>
          <label className="form-field">Foto privada (opcional)<input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => setListing({ ...listing, photo: event.target.files?.[0] || null })} /></label>
          <button className="primary-button" disabled={busy || !farms.length} type="submit">Crear y publicar</button>
        </form>
      </section>

      <section className="platform-stack">
        <div className="panel">
          <div className="panel-heading"><h2>Mis publicaciones</h2><button className="secondary-button compact-button" onClick={() => load()} type="button">Actualizar</button></div>
          <FormStatus error={error} notice={notice} />
          <div className="platform-records">
            {listings.map((item) => <ListingCard key={item.id} listing={item} actions={<button className="secondary-button compact-button" onClick={() => loadBids(item.id)} type="button">Ver ofertas ({item._count?.bids || 0})</button>} />)}
            {!listings.length && <p className="helper-copy">Aún no tienes publicaciones.</p>}
          </div>
        </div>
        {selectedListingId && (
          <div className="panel">
            <h2>Ofertas anónimas</h2>
            <div className="platform-records">
              {bids.map((bid) => (
                <article className="platform-record" key={bid.id}>
                  <h3>{bid.anonymousLabel}</h3>
                  <p>{money.format(Number(bid.terms.netAmountCop))} netos · pago a {bid.terms.paymentTermDays} días</p>
                  <button className="primary-button compact-button" disabled={busy || bid.status !== "SUBMITTED"} onClick={() => award(bid.id)} type="button">Adjudicar</button>
                </article>
              ))}
              {!bids.length && <p className="helper-copy">Esta publicación todavía no tiene ofertas.</p>}
            </div>
            {winner && <div className="winner-reveal"><span>Comprador ganador</span><h3>{winner.businessName || winner.displayName}</h3><p>{winner.email}</p><p>{winner.phone || "Sin teléfono"}</p></div>}
          </div>
        )}
      </section>
    </div>
  );
}
