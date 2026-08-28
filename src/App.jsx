import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  EyeOff,
  Filter,
  HandCoins,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sprout,
  Star,
  Truck,
  UserRound,
  WalletCards
} from "lucide-react";

const farmer = {
  farm: "Finca La Esperanza",
  owner: "Mariela Cardenas",
  location: "Tauramena, Casanare",
  village: "Vereda Paso Cusiana",
  crops: "Platano harton, yuca y maiz",
  hectares: "6 ha productivas",
  score: "4.8",
  description:
    "Productora familiar con acceso vial terciario y cosechas programadas para compradores regionales."
};

const listing = {
  title: "2.5 toneladas de platano harton",
  status: "Abierta",
  harvestDate: "Lista en 8 dias",
  location: "Tauramena",
  access: "Camion NPR hasta punto de cargue",
  expectedPrice: "COP 7.500.000",
  deadline: "Cierra hoy 6:00 p.m.",
  quality: "Calibre mixto, racimo seleccionado",
  photos: [
    "https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=80"
  ]
};

const buyerMatches = [
  {
    name: "Mayorista regional",
    zone: "Yopal",
    need: "2 a 4 toneladas semanales",
    tag: "Busca recogida en finca",
    fit: 92
  },
  {
    name: "Distribuidor de plaza",
    zone: "Aguazul",
    need: "Compra lote completo",
    tag: "Pago contra entrega",
    fit: 86
  },
  {
    name: "Restaurante aliado",
    zone: "Villanueva",
    need: "Calidad uniforme",
    tag: "Compra recurrente",
    fit: 78
  }
];

const bids = [
  {
    id: "A",
    gross: 8000000,
    transportCost: 850000,
    label: "Pujador A",
    headline: "Mayor precio bruto",
    transport: "Productor entrega en bodega",
    pickup: "No recoge en finca",
    advance: 0,
    paymentDays: 5,
    fullLot: true,
    continuity: "Sin compromiso futuro",
    risk: "Medio",
    notes: "Exige clasificacion adicional antes de recibir.",
    score: 74
  },
  {
    id: "B",
    gross: 6700000,
    transportCost: 0,
    label: "Pujador B",
    headline: "Mejor flujo y menor riesgo",
    transport: "Comprador asume transporte",
    pickup: "Recoge en finca",
    advance: 70,
    paymentDays: 0,
    fullLot: true,
    continuity: "Opcion mensual",
    risk: "Bajo",
    notes: "Compra todo el lote con calibres mixtos.",
    score: 93
  },
  {
    id: "C",
    gross: 7200000,
    transportCost: 250000,
    label: "Pujador C",
    headline: "Buena continuidad",
    transport: "Flete compartido",
    pickup: "Recoge en punto acordado",
    advance: 30,
    paymentDays: 8,
    fullLot: false,
    continuity: "Contrato por 3 cosechas",
    risk: "Medio",
    notes: "Compra 80% del lote y paga saldo a ocho dias.",
    score: 82
  }
];

const tabs = [
  { id: "finca", label: "Finca", icon: UserRound },
  { id: "cosecha", label: "Cosecha", icon: Sprout },
  { id: "mercado", label: "Mercado", icon: Search },
  { id: "pujas", label: "Pujas", icon: HandCoins }
];

function currency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

function App() {
  const [activeTab, setActiveTab] = useState("finca");
  const [acceptedBid, setAcceptedBid] = useState(null);
  const [draft, setDraft] = useState(
    "Tengo platano harton listo en ocho dias. Son como dos toneladas y media, en Tauramena."
  );

  const enhancedDraft = useMemo(() => {
    return "Finca La Esperanza ofrece 2.5 toneladas de platano harton en Tauramena, Casanare, listas para cosecha en 8 dias. El lote cuenta con calibre mixto seleccionado, acceso para camion NPR hasta punto de cargue y disponibilidad para venta total. Se reciben pujas con condiciones de transporte, anticipo y fecha de pago.";
  }, []);

  const rankedBids = useMemo(() => {
    return bids
      .map((bid) => ({
        ...bid,
        net: bid.gross - bid.transportCost
      }))
      .sort((a, b) => b.score - a.score);
  }, []);

  const bestBid = rankedBids[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ADP</div>
          <div>
            <p className="eyebrow">Asociacion de Plataneros</p>
            <h1>Negociacion inteligente de cosechas</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacion principal">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="status-panel">
          <div>
            <span className="status-dot" />
            <p>Publicacion abierta</p>
          </div>
          <strong>3 pujas anonimas</strong>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Demo fase 1</p>
            <h2>{listing.title}</h2>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" title="Filtros">
              <Filter aria-hidden="true" size={18} />
            </button>
            <button className="icon-button" type="button" title="Alertas">
              <Bell aria-hidden="true" size={18} />
            </button>
          </div>
        </header>

        <section className="summary-grid">
          <Metric icon={MapPin} label="Zona" value={listing.location} />
          <Metric icon={Clock3} label="Cosecha" value={listing.harvestDate} />
          <Metric icon={WalletCards} label="Esperado" value={listing.expectedPrice} />
          <Metric icon={HandCoins} label="Mejor puja" value={currency(bestBid.net)} />
        </section>

        {activeTab === "finca" && <FarmPanel />}
        {activeTab === "cosecha" && (
          <ListingPanel
            draft={draft}
            enhancedDraft={enhancedDraft}
            setDraft={setDraft}
          />
        )}
        {activeTab === "mercado" && <MarketPanel />}
        {activeTab === "pujas" && (
          <BidsPanel
            acceptedBid={acceptedBid}
            bestBid={bestBid}
            bids={rankedBids}
            onAccept={setAcceptedBid}
          />
        )}
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <Icon aria-hidden="true" size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function FarmPanel() {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Perfil del finquero</p>
            <h3>{farmer.farm}</h3>
          </div>
          <span className="pill">
            <Star aria-hidden="true" size={15} />
            {farmer.score}
          </span>
        </div>
        <div className="farm-hero">
          <div className="farm-photo" role="img" aria-label="Cultivo de platano" />
          <div className="farm-details">
            <InfoRow label="Responsable" value={farmer.owner} />
            <InfoRow label="Ubicacion" value={farmer.location} />
            <InfoRow label="Vereda" value={farmer.village} />
            <InfoRow label="Cultivos" value={farmer.crops} />
            <InfoRow label="Area" value={farmer.hectares} />
          </div>
        </div>
        <p className="body-copy">{farmer.description}</p>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h3>Confianza</h3>
          <ShieldCheck aria-hidden="true" size={20} />
        </div>
        <ul className="check-list">
          <li>
            <Check aria-hidden="true" size={17} />
            Telefono verificado
          </li>
          <li>
            <Check aria-hidden="true" size={17} />
            Historial de cosechas activo
          </li>
          <li>
            <Check aria-hidden="true" size={17} />
            Ubicacion aproximada validada
          </li>
        </ul>
      </section>
    </div>
  );
}

function ListingPanel({ draft, enhancedDraft, setDraft }) {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Publicacion asistida por IA</p>
            <h3>Cosecha disponible</h3>
          </div>
          <span className="pill accent">IA lista</span>
        </div>

        <div className="listing-layout">
          <div className="photo-stack">
            {listing.photos.map((photo) => (
              <img alt="Platano harton en cosecha" key={photo} src={photo} />
            ))}
          </div>
          <div className="listing-facts">
            <InfoRow label="Cantidad" value="2.5 toneladas estimadas" />
            <InfoRow label="Tipo" value="Platano harton" />
            <InfoRow label="Calidad" value={listing.quality} />
            <InfoRow label="Acceso" value={listing.access} />
            <InfoRow label="Fecha limite" value={listing.deadline} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h3>Texto comercial</h3>
          <BadgeCheck aria-hidden="true" size={20} />
        </div>
        <textarea
          aria-label="Borrador de publicacion"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="ai-output">
          <p>{enhancedDraft}</p>
        </div>
      </section>
    </div>
  );
}

function MarketPanel() {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Compradores sugeridos</p>
            <h3>Coincidencias por zona y necesidad</h3>
          </div>
          <button className="text-button" type="button">
            <Search aria-hidden="true" size={17} />
            Buscar
          </button>
        </div>

        <div className="buyer-list">
          {buyerMatches.map((buyer) => (
            <article className="buyer-card" key={buyer.name}>
              <div>
                <h4>{buyer.name}</h4>
                <p>{buyer.need}</p>
                <span>{buyer.zone} - {buyer.tag}</span>
              </div>
              <strong>{buyer.fit}%</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h3>Busqueda IA</h3>
          <MessageCircle aria-hidden="true" size={20} />
        </div>
        <div className="chat-card">
          <p className="chat-question">Busco platano harton cerca de Yopal para recoger esta semana.</p>
          <p className="chat-answer">
            Hay una cosecha en Tauramena con 2.5 toneladas listas en 8 dias y acceso para camion NPR.
          </p>
        </div>
      </section>
    </div>
  );
}

function BidsPanel({ acceptedBid, bestBid, bids, onAccept }) {
  return (
    <div className="content-grid">
      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Pujas anonimas</p>
            <h3>Comparador de valor total</h3>
          </div>
          <span className="pill">
            <EyeOff aria-hidden="true" size={15} />
            Identidad oculta
          </span>
        </div>

        <div className="bid-list">
          {bids.map((bid) => (
            <BidCard
              bid={bid}
              isAccepted={acceptedBid === bid.id}
              isBest={bestBid.id === bid.id}
              key={bid.id}
              onAccept={onAccept}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading compact">
          <h3>Lectura IA</h3>
          <BadgeCheck aria-hidden="true" size={20} />
        </div>
        <div className="ai-recommendation">
          <strong>Recomendacion: {bestBid.label}</strong>
          <p>
            No es la oferta de mayor precio bruto, pero recoge en finca, paga 70%
            de anticipo y compra el lote completo. Reduce transporte, riesgo y
            tiempo de cobro para la finca.
          </p>
        </div>
        {acceptedBid && (
          <a
            className="whatsapp-link"
            href="https://wa.me/573001112233?text=Hola%2C%20acepte%20tu%20puja%20por%20la%20cosecha%20de%20platano%20harton."
            rel="noreferrer"
            target="_blank"
          >
            <MessageCircle aria-hidden="true" size={18} />
            Abrir WhatsApp
          </a>
        )}
      </section>
    </div>
  );
}

function BidCard({ bid, isAccepted, isBest, onAccept }) {
  return (
    <article className={`bid-card ${isBest ? "best" : ""} ${isAccepted ? "accepted" : ""}`}>
      <div className="bid-topline">
        <div>
          <span className="anonymous-badge">{bid.label}</span>
          <h4>{bid.headline}</h4>
        </div>
        <strong>{bid.score}</strong>
      </div>
      <div className="bid-money">
        <div>
          <span>Precio bruto</span>
          <strong>{currency(bid.gross)}</strong>
        </div>
        <ChevronRight aria-hidden="true" size={18} />
        <div>
          <span>Valor neto estimado</span>
          <strong>{currency(bid.net)}</strong>
        </div>
      </div>
      <div className="bid-conditions">
        <span>
          <Truck aria-hidden="true" size={15} />
          {bid.transport}
        </span>
        <span>
          <WalletCards aria-hidden="true" size={15} />
          {bid.advance}% anticipo
        </span>
        <span>
          <Clock3 aria-hidden="true" size={15} />
          Pago {bid.paymentDays === 0 ? "inmediato" : `${bid.paymentDays} dias`}
        </span>
      </div>
      <p>{bid.notes}</p>
      <button
        className="accept-button"
        disabled={isAccepted}
        onClick={() => onAccept(bid.id)}
        type="button"
      >
        {isAccepted ? (
          <>
            <Check aria-hidden="true" size={17} />
            Puja aceptada
          </>
        ) : (
          <>
            <ArrowUpRight aria-hidden="true" size={17} />
            Aceptar puja
          </>
        )}
      </button>
    </article>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
