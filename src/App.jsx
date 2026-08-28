import { useEffect, useMemo, useRef, useState } from "react";
import { HandCoins, Search, Sprout, UserRound } from "lucide-react";
import {
  BidsPanel,
  ConfirmationDialog,
  FarmPanel,
  ListingPanel,
  MarketPanel,
  Metric
} from "./components/Panels.jsx";
import {
  bids,
  buyerMatches,
  demoPhotos,
  initialListing,
  tabs
} from "./data/demoData.js";
import {
  buildAiSuggestion,
  currency,
  listingTitle,
  validateAiFields,
  validateListing
} from "./lib/demo.js";
import { PlatformApp } from "./components/PlatformApp.jsx";

const tabIcons = {
  finca: <UserRound aria-hidden="true" size={18} />,
  cosecha: <Sprout aria-hidden="true" size={18} />,
  mercado: <Search aria-hidden="true" size={18} />,
  pujas: <HandCoins aria-hidden="true" size={18} />
};

function freshPhotos() {
  return demoPhotos.map((photo) => ({ ...photo }));
}

function DemoApp({ onOpenPlatform }) {
  const [activeTab, setActiveTab] = useState("finca");
  const [status, setStatus] = useState("draft");
  const [draft, setDraft] = useState({ ...initialListing });
  const [photos, setPhotos] = useState(freshPhotos);
  const [publishedListing, setPublishedListing] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [errors, setErrors] = useState({});
  const [photoError, setPhotoError] = useState("");
  const [pendingBidId, setPendingBidId] = useState(null);
  const [acceptedBidId, setAcceptedBidId] = useState(null);
  const localPhotoUrls = useRef(new Set());

  useEffect(() => {
    const urls = localPhotoUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const rankedBids = useMemo(
    () =>
      bids
        .map((bid) => ({ ...bid, net: bid.gross - bid.transportCost }))
        .sort((first, second) => second.score - first.score),
    []
  );
  const bestBid = rankedBids[0];
  const pendingBid = rankedBids.find((bid) => bid.id === pendingBidId) ?? null;
  const acceptedBid = rankedBids.find((bid) => bid.id === acceptedBidId) ?? null;
  const activeListing = publishedListing ?? draft;
  const isPublished = status !== "draft" && Boolean(publishedListing);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setAiSuggestion("");
  }

  function generateSuggestion() {
    const aiErrors = validateAiFields(draft);
    if (Object.keys(aiErrors).length) {
      setErrors((current) => ({ ...current, ...aiErrors }));
      setAiSuggestion("");
      return;
    }
    setErrors({});
    setAiSuggestion(buildAiSuggestion(draft));
  }

  function applySuggestion() {
    if (!aiSuggestion) return;
    setDraft((current) => ({ ...current, description: aiSuggestion }));
    setErrors((current) => ({ ...current, description: undefined }));
  }

  function addPhotos(fileList) {
    const files = Array.from(fileList ?? []);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const validFiles = files.filter(
      (file) => allowedTypes.has(file.type) && file.size <= 5 * 1024 * 1024
    );
    const availableSlots = Math.max(0, 3 - photos.length);

    if (!files.length) return;
    if (validFiles.length !== files.length) {
      setPhotoError("Usa archivos JPG, PNG o WebP de máximo 5 MB.");
      return;
    }
    if (files.length > availableSlots) {
      setPhotoError(`Puedes agregar ${availableSlots} foto${availableSlots === 1 ? "" : "s"} más.`);
      return;
    }

    const uploaded = files.map((file, index) => {
      const src = URL.createObjectURL(file);
      localPhotoUrls.current.add(src);
      return {
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        src,
        isLocal: true
      };
    });
    setPhotos((current) => [...current, ...uploaded]);
    setPhotoError("");
    setErrors((current) => ({ ...current, photos: undefined }));
  }

  function removePhoto(photoId) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed?.isLocal) {
        URL.revokeObjectURL(removed.src);
        localPhotoUrls.current.delete(removed.src);
      }
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  function publishListing(event) {
    event.preventDefault();
    const validationErrors = validateListing(draft, photos);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setPublishedListing({
      ...draft,
      photos: photos.map((photo) => ({ ...photo }))
    });
    setStatus("published");
    setAcceptedBidId(null);
    setActiveTab("cosecha");
  }

  function editListing() {
    setPublishedListing(null);
    setStatus("draft");
    setAcceptedBidId(null);
    setPendingBidId(null);
    setActiveTab("cosecha");
  }

  function confirmAcceptance() {
    if (!pendingBidId) return;
    setAcceptedBidId(pendingBidId);
    setPendingBidId(null);
    setStatus("accepted");
  }

  function resetDemo() {
    localPhotoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    localPhotoUrls.current.clear();
    setActiveTab("finca");
    setStatus("draft");
    setDraft({ ...initialListing });
    setPhotos(freshPhotos());
    setPublishedListing(null);
    setAiSuggestion("");
    setErrors({});
    setPhotoError("");
    setPendingBidId(null);
    setAcceptedBidId(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ADP</div>
          <div>
            <p className="eyebrow">Asociación de Plataneros</p>
            <h1>Negociación inteligente de cosechas</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegación principal">
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tabIcons[tab.id]}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="status-panel" aria-live="polite">
          <div>
            <span className={`status-dot ${status}`} />
            <p>{status === "draft" ? "Publicación en borrador" : status === "published" ? "Publicación abierta" : "Negociación en cierre"}</p>
          </div>
          <strong>{isPublished ? "3 pujas anónimas" : "Aún sin pujas"}</strong>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Demo Fase 1 · {status === "draft" ? "Borrador" : status === "published" ? "Publicada" : "Puja aceptada"}</p>
            <h2>{listingTitle(activeListing)}</h2>
          </div>
          <div className="button-row">
            {onOpenPlatform && <button className="primary-button compact-button" onClick={onOpenPlatform} type="button">Usar plataforma real</button>}
            <button className="secondary-button compact-button" onClick={resetDemo} type="button">
              Reiniciar demo
            </button>
          </div>
        </header>

        <section className="summary-grid" aria-label="Resumen de la publicación">
          <Metric label="Zona" value={activeListing.location} />
          <Metric label="Cosecha" value={`Lista en ${activeListing.harvestDays} días`} />
          <Metric label="Esperado" value={currency(activeListing.expectedPrice)} />
          <Metric label="Mejor puja" value={isPublished ? currency(bestBid.net) : "Pendiente"} />
        </section>

        {activeTab === "finca" && <FarmPanel onContinue={() => setActiveTab("cosecha")} />}
        {activeTab === "cosecha" && (
          <ListingPanel
            aiSuggestion={aiSuggestion}
            draft={draft}
            errors={errors}
            onAddPhotos={addPhotos}
            onApplySuggestion={applySuggestion}
            onContinue={() => setActiveTab("mercado")}
            onEdit={editListing}
            onGenerateSuggestion={generateSuggestion}
            onPublish={publishListing}
            onRemovePhoto={removePhoto}
            onUpdate={updateDraft}
            photoError={photoError}
            photos={photos}
            publishedListing={publishedListing}
            status={status}
          />
        )}
        {activeTab === "mercado" && (
          <MarketPanel
            buyers={buyerMatches}
            isPublished={isPublished}
            onContinue={() => setActiveTab("pujas")}
            onReturn={() => setActiveTab("cosecha")}
          />
        )}
        {activeTab === "pujas" && (
          <BidsPanel
            acceptedBid={acceptedBid}
            bestBid={bestBid}
            bids={rankedBids}
            isPublished={isPublished}
            listing={publishedListing}
            onAccept={setPendingBidId}
            onReset={resetDemo}
            onReturn={() => setActiveTab("cosecha")}
          />
        )}
      </main>

      <ConfirmationDialog
        bid={pendingBid}
        onCancel={() => setPendingBidId(null)}
        onConfirm={confirmAcceptance}
      />
    </div>
  );
}

function App({ initialMode = "platform", api }) {
  const [mode, setMode] = useState(initialMode);
  if (mode === "demo") {
    return <DemoApp onOpenPlatform={() => setMode("platform")} />;
  }
  return <PlatformApp client={api} onOpenDemo={() => setMode("demo")} />;
}

export default App;
