import { useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock3,
  EyeOff,
  HandCoins,
  ImagePlus,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Trash2,
  Truck,
  Upload,
  WalletCards,
  WandSparkles,
  X
} from "lucide-react";
import { farmer } from "../data/demoData.js";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  currency,
  listingTitle
} from "../lib/demo.js";

export function Metric({ label, value }) {
  const icons = {
    Zona: <MapPin aria-hidden="true" size={20} />,
    Cosecha: <Clock3 aria-hidden="true" size={20} />,
    Esperado: <WalletCards aria-hidden="true" size={20} />,
    "Mejor puja": <HandCoins aria-hidden="true" size={20} />
  };
  return (
    <article className="metric-card">
      {icons[label]}
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

export function FarmPanel({ onContinue }) {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div><p className="eyebrow">Perfil del finquero</p><h3>{farmer.farm}</h3></div>
          <span className="pill"><Star aria-hidden="true" size={15} /> {farmer.score}</span>
        </div>
        <div className="farm-hero">
          <img alt="Cultivo de plátano hartón en una finca de Casanare" src={farmer.heroImage} />
          <div className="farm-details">
            <InfoRow label="Responsable" value={farmer.owner} />
            <InfoRow label="Ubicación" value={farmer.location} />
            <InfoRow label="Vereda" value={farmer.village} />
            <InfoRow label="Cultivos" value={farmer.crops} />
            <InfoRow label="Área" value={farmer.hectares} />
          </div>
        </div>
        <p className="body-copy">{farmer.description}</p>
        <button className="primary-button" onClick={onContinue} type="button">
          Preparar publicación <ArrowRight aria-hidden="true" size={18} />
        </button>
      </section>
      <section className="panel">
        <div className="panel-heading compact"><h3>Confianza</h3><ShieldCheck aria-hidden="true" size={20} /></div>
        <ul className="check-list">
          <li><Check aria-hidden="true" size={17} /> Teléfono verificado</li>
          <li><Check aria-hidden="true" size={17} /> Historial de cosechas activo</li>
          <li><Check aria-hidden="true" size={17} /> Ubicación aproximada validada</li>
        </ul>
      </section>
    </div>
  );
}

export function ListingPanel(props) {
  if (props.status !== "draft" && props.publishedListing) {
    return <PublishedListing {...props} listing={props.publishedListing} />;
  }

  const { aiSuggestion, draft, errors, onAddPhotos, onApplySuggestion,
    onGenerateSuggestion, onPublish, onRemovePhoto, onUpdate, photoError, photos } = props;

  return (
    <form className="listing-form" noValidate onSubmit={onPublish}>
      <section className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Paso 1</p><h3>Datos de la cosecha</h3></div>
          <span className="pill draft-pill">Borrador</span>
        </div>
        <div className="form-grid">
          <FormField error={errors.crop} label="Tipo de cultivo">
            <input aria-invalid={Boolean(errors.crop)} name="crop" onChange={(event) => onUpdate("crop", event.target.value)} value={draft.crop} />
          </FormField>
          <FormField error={errors.quantity} label="Cantidad (toneladas)">
            <input aria-invalid={Boolean(errors.quantity)} inputMode="decimal" min="0.1" name="quantity" onChange={(event) => onUpdate("quantity", event.target.value)} step="0.1" type="number" value={draft.quantity} />
          </FormField>
          <FormField error={errors.harvestDays} label="Disponible en (días)">
            <input aria-invalid={Boolean(errors.harvestDays)} inputMode="numeric" min="0" name="harvestDays" onChange={(event) => onUpdate("harvestDays", event.target.value)} step="1" type="number" value={draft.harvestDays} />
          </FormField>
          <FormField error={errors.location} label="Ubicación">
            <input aria-invalid={Boolean(errors.location)} name="location" onChange={(event) => onUpdate("location", event.target.value)} value={draft.location} />
          </FormField>
          <FormField error={errors.quality} label="Calidad">
            <input aria-invalid={Boolean(errors.quality)} name="quality" onChange={(event) => onUpdate("quality", event.target.value)} value={draft.quality} />
          </FormField>
          <FormField error={errors.access} label="Acceso vial">
            <input aria-invalid={Boolean(errors.access)} name="access" onChange={(event) => onUpdate("access", event.target.value)} value={draft.access} />
          </FormField>
          <FormField error={errors.expectedPrice} label="Precio esperado (COP)">
            <input aria-invalid={Boolean(errors.expectedPrice)} inputMode="numeric" min="1" name="expectedPrice" onChange={(event) => onUpdate("expectedPrice", event.target.value)} step="50000" type="number" value={draft.expectedPrice} />
          </FormField>
          <FormField error={errors.deadline} label="Cierre de pujas">
            <input aria-invalid={Boolean(errors.deadline)} name="deadline" onChange={(event) => onUpdate("deadline", event.target.value)} value={draft.deadline} />
          </FormField>
          <FormField className="full-field" error={errors.conditions} label="Condiciones comerciales">
            <input aria-invalid={Boolean(errors.conditions)} name="conditions" onChange={(event) => onUpdate("conditions", event.target.value)} value={draft.conditions} />
          </FormField>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <div><p className="eyebrow">Paso 2</p><h3>Fotos de plátano</h3></div>
          <ImagePlus aria-hidden="true" size={20} />
        </div>
        <p className="helper-copy">Hasta 3 imágenes JPG, PNG o WebP de máximo 5 MB.</p>
        <div className="upload-grid">
          {photos.map((photo) => (
            <figure className="photo-preview" key={photo.id}>
              <img alt={photo.name} src={photo.src} />
              <button aria-label={`Eliminar ${photo.name}`} onClick={() => onRemovePhoto(photo.id)} type="button"><Trash2 aria-hidden="true" size={16} /></button>
            </figure>
          ))}
          {photos.length < 3 && (
            <label className="upload-button">
              <Upload aria-hidden="true" size={20} /><span>Agregar fotos</span>
              <input accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { onAddPhotos(event.target.files); event.target.value = ""; }} type="file" />
            </label>
          )}
        </div>
        {(photoError || errors.photos) && <p className="field-error" role="alert">{photoError || errors.photos}</p>}
      </section>

      <section className="panel ai-panel">
        <div className="panel-heading compact">
          <div><p className="eyebrow">Paso 3</p><h3>Texto comercial asistido</h3></div>
          <WandSparkles aria-hidden="true" size={20} />
        </div>
        <FormField error={errors.description} label="Descripción de la cosecha">
          <textarea aria-invalid={Boolean(errors.description)} name="description" onChange={(event) => onUpdate("description", event.target.value)} rows="5" value={draft.description} />
        </FormField>
        <button className="secondary-button" onClick={onGenerateSuggestion} type="button"><WandSparkles aria-hidden="true" size={17} /> Mejorar con IA simulada</button>
        {aiSuggestion && (
          <div className="ai-output" aria-live="polite">
            <span>Sugerencia lista</span><p>{aiSuggestion}</p>
            <button className="text-action" onClick={onApplySuggestion} type="button">Usar texto mejorado</button>
          </div>
        )}
      </section>

      <section className="form-submit-bar">
        <div><strong>Lista para salir al mercado</strong><p>Al publicar aparecerán los compradores y las pujas simuladas.</p></div>
        <button className="primary-button" type="submit">Publicar cosecha <ArrowUpRight aria-hidden="true" size={18} /></button>
      </section>
    </form>
  );
}

function PublishedListing({ listing, onContinue, onEdit, status }) {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div><p className="eyebrow">Vista pública de la cosecha</p><h3>{listingTitle(listing)}</h3></div>
          <span className={`pill ${status === "accepted" ? "accepted-pill" : "accent"}`}>{status === "accepted" ? "Puja aceptada" : "Publicada"}</span>
        </div>
        <div className="listing-layout">
          <div className="photo-stack">{listing.photos.map((photo) => <img alt={photo.name} key={photo.id} src={photo.src} />)}</div>
          <div className="listing-facts">
            <InfoRow label="Cantidad" value={`${listing.quantity} toneladas estimadas`} />
            <InfoRow label="Tipo" value={listing.crop} />
            <InfoRow label="Calidad" value={listing.quality} />
            <InfoRow label="Acceso" value={listing.access} />
            <InfoRow label="Fecha límite" value={listing.deadline} />
            <InfoRow label="Precio esperado" value={currency(listing.expectedPrice)} />
          </div>
        </div>
        <div className="publication-copy"><span>Descripción comercial</span><p>{listing.description}</p></div>
        <div className="button-row">
          {status !== "accepted" && <button className="secondary-button" onClick={onEdit} type="button">Editar publicación</button>}
          <button className="primary-button" onClick={onContinue} type="button">Ver compradores sugeridos <ArrowRight aria-hidden="true" size={18} /></button>
        </div>
      </section>
      <section className="panel success-panel">
        <BadgeCheck aria-hidden="true" size={28} /><h3>{status === "accepted" ? "Negociación en cierre" : "Publicación activa"}</h3>
        <p>{status === "accepted" ? "La oferta ganadora ya fue confirmada. Continúa en Pujas para contactar al comprador." : "La cosecha ya puede recibir ofertas de compradores compatibles."}</p>
      </section>
    </div>
  );
}

export function MarketPanel({ buyers, isPublished, onContinue, onReturn }) {
  if (!isPublished) {
    return <EmptyState action="Ir a publicar" description="Publica la cosecha para activar las coincidencias por zona y necesidad." onAction={onReturn} title="El mercado espera tu publicación" />;
  }
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div><p className="eyebrow">Compradores sugeridos</p><h3>Coincidencias por zona y necesidad</h3></div><span className="pill accent">3 coincidencias</span>
        </div>
        <div className="buyer-list">
          {buyers.map((buyer) => (
            <article className="buyer-card" key={buyer.name}>
              <div><h4>{buyer.name}</h4><p>{buyer.need}</p><span>{buyer.zone} · {buyer.tag}</span></div>
              <strong aria-label={`${buyer.fit} por ciento de compatibilidad`}>{buyer.fit}%</strong>
            </article>
          ))}
        </div>
        <button className="primary-button" onClick={onContinue} type="button">Revisar pujas recibidas <ArrowRight aria-hidden="true" size={18} /></button>
      </section>
      <section className="panel">
        <div className="panel-heading compact"><h3>Búsqueda IA simulada</h3><MessageCircle aria-hidden="true" size={20} /></div>
        <div className="chat-card">
          <p className="chat-question">Busco plátano hartón cerca de Yopal para recoger esta semana.</p>
          <p className="chat-answer">Hay una cosecha en Tauramena con 2.5 toneladas listas en 8 días y acceso para camión NPR.</p>
        </div>
      </section>
    </div>
  );
}

export function BidsPanel({ acceptedBid, bestBid, bids, isPublished, listing, onAccept, onReset, onReturn }) {
  if (!isPublished || !listing) {
    return <EmptyState action="Ir a publicar" description="Las tres ofertas simuladas se habilitan cuando la cosecha queda publicada." onAction={onReturn} title="Todavía no hay pujas" />;
  }
  const whatsappUrl = acceptedBid ? buildWhatsAppUrl(import.meta.env.VITE_WHATSAPP_NUMBER, buildWhatsAppMessage(listing, acceptedBid)) : "";
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div><p className="eyebrow">Pujas anónimas</p><h3>Comparador de valor total</h3></div>
          <span className="pill"><EyeOff aria-hidden="true" size={15} /> {acceptedBid ? "Proceso cerrado" : "Identidad oculta"}</span>
        </div>
        <div className="bid-list">{bids.map((bid) => <BidCard acceptedBid={acceptedBid} bid={bid} isBest={bestBid.id === bid.id} key={bid.id} onAccept={onAccept} />)}</div>
      </section>
      <section className="panel bid-summary-panel">
        <div className="panel-heading compact"><h3>{acceptedBid ? "Comprador ganador" : "Lectura IA"}</h3><BadgeCheck aria-hidden="true" size={20} /></div>
        {acceptedBid ? (
          <div className="winner-reveal" aria-live="polite">
            <span>{acceptedBid.label} revelado</span><h4>{acceptedBid.buyer.name}</h4><p>{acceptedBid.buyer.contact}</p><p>{acceptedBid.buyer.zone}</p>
            <a className="whatsapp-link" href={whatsappUrl} rel="noreferrer" target="_blank"><MessageCircle aria-hidden="true" size={18} /> Abrir WhatsApp</a>
            <button className="secondary-button" onClick={onReset} type="button">Reiniciar demo</button>
          </div>
        ) : (
          <div className="ai-recommendation"><strong>Recomendación: {bestBid.label}</strong><p>No es la oferta de mayor precio bruto, pero recoge en finca, paga 70% de anticipo y compra el lote completo. Reduce transporte, riesgo y tiempo de cobro.</p></div>
        )}
      </section>
    </div>
  );
}

function BidCard({ acceptedBid, bid, isBest, onAccept }) {
  const isAccepted = acceptedBid?.id === bid.id;
  const isClosed = Boolean(acceptedBid);
  return (
    <article className={`bid-card ${isBest ? "best" : ""} ${isAccepted ? "accepted" : ""}`}>
      <div className="bid-topline"><div><span className="anonymous-badge">{bid.label}</span><h4>{bid.headline}</h4></div><strong aria-label={`Puntuación ${bid.score} de 100`}>{bid.score}</strong></div>
      <div className="bid-money"><div><span>Precio bruto</span><strong>{currency(bid.gross)}</strong></div><ArrowRight aria-hidden="true" size={18} /><div><span>Valor neto estimado</span><strong>{currency(bid.net)}</strong></div></div>
      <div className="bid-conditions"><span><Truck aria-hidden="true" size={15} /> {bid.transport}</span><span><WalletCards aria-hidden="true" size={15} /> {bid.advance}% anticipo</span><span><Clock3 aria-hidden="true" size={15} /> Pago {bid.paymentDays === 0 ? "inmediato" : `${bid.paymentDays} días`}</span></div>
      <p>{bid.notes}</p>
      {isAccepted && <p className="revealed-inline"><Check aria-hidden="true" size={16} /> {bid.buyer.name}</p>}
      <button className="accept-button" disabled={isClosed} onClick={() => onAccept(bid.id)} type="button">{isAccepted ? <><Check aria-hidden="true" size={17} /> Puja aceptada</> : isClosed ? "Proceso cerrado" : <><ArrowUpRight aria-hidden="true" size={17} /> Aceptar puja</>}</button>
    </article>
  );
}

export function ConfirmationDialog({ bid, onCancel, onConfirm }) {
  const cancelButton = useRef(null);
  useEffect(() => {
    if (!bid) return undefined;
    cancelButton.current?.focus();
    function handleKeyDown(event) { if (event.key === "Escape") onCancel(); }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bid, onCancel]);
  if (!bid) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-describedby="accept-dialog-description" aria-labelledby="accept-dialog-title" aria-modal="true" className="dialog" role="dialog">
        <button aria-label="Cerrar confirmación" className="dialog-close" onClick={onCancel} type="button"><X aria-hidden="true" size={20} /></button>
        <p className="eyebrow">Confirmar decisión</p><h3 id="accept-dialog-title">¿Aceptar la oferta del {bid.label}?</h3>
        <p id="accept-dialog-description">La oferta quedará seleccionada, se bloquearán las demás pujas y se revelará el comprador ganador.</p>
        <div className="dialog-summary"><InfoRow label="Precio bruto" value={currency(bid.gross)} /><InfoRow label="Valor neto" value={currency(bid.net)} /><InfoRow label="Anticipo" value={`${bid.advance}%`} /></div>
        <div className="button-row"><button className="secondary-button" onClick={onCancel} ref={cancelButton} type="button">Volver</button><button className="primary-button" onClick={onConfirm} type="button">Confirmar aceptación</button></div>
      </section>
    </div>
  );
}

function EmptyState({ action, description, onAction, title }) {
  return <section className="panel empty-state"><div aria-hidden="true" className="empty-mark"><HandCoins size={28} /></div><h3>{title}</h3><p>{description}</p><button className="primary-button" onClick={onAction} type="button">{action} <ArrowRight aria-hidden="true" size={18} /></button></section>;
}

function FormField({ children, className = "", error, label }) {
  return <label className={`form-field ${className}`}><span>{label}</span>{children}{error && <small className="field-error" role="alert">{error}</small>}</label>;
}

function InfoRow({ label, value }) {
  return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>;
}
