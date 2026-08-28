import { money } from "./utils.js";

export function FormStatus({ error, notice }) {
  return (
    <div aria-live="polite">
      {error && <p className="platform-alert error">{error}</p>}
      {notice && <p className="platform-alert success">{notice}</p>}
    </div>
  );
}

export function ListingCard({ listing, actions }) {
  return (
    <article className="platform-record">
      <div>
        <span className="pill">{listing.status || "OPEN"}</span>
        <h3>{listing.cropVariety?.name || "Cosecha"}</h3>
        <p>{listing.farm?.name} · {listing.farm?.publicLocationText}</p>
      </div>
      <dl>
        <div><dt>Cantidad</dt><dd>{listing.estimatedQuantityKg} kg</dd></div>
        <div><dt>Precio esperado</dt><dd>{listing.expectedPriceCopPerKg ? money.format(Number(listing.expectedPriceCopPerKg)) : "Abierto"}</dd></div>
        <div><dt>Cierre</dt><dd>{new Date(listing.bidDeadlineAt).toLocaleString("es-CO")}</dd></div>
      </dl>
      {actions && <div className="button-row">{actions}</div>}
    </article>
  );
}
