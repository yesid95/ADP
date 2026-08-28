export const farmer = {
  farm: "Finca La Esperanza",
  owner: "Mariela Cárdenas",
  location: "Tauramena, Casanare",
  village: "Vereda Paso Cusiana",
  crops: "Plátano hartón, yuca y maíz",
  hectares: "6 ha productivas",
  score: "4.8",
  description:
    "Productora familiar con acceso vial terciario y cosechas programadas para compradores regionales.",
  heroImage: "/assets/finca-platanera-casanare.png"
};

export const demoPhotos = [
  {
    id: "demo-racimo",
    name: "Racimo de plátano hartón recién cosechado",
    src: "/assets/racimo-platano-harton.png",
    isLocal: false
  },
  {
    id: "demo-cargue",
    name: "Plátano hartón listo para cargue",
    src: "/assets/platano-listo-cargue.png",
    isLocal: false
  }
];

export const initialListing = {
  crop: "Plátano hartón",
  quantity: "2.5",
  harvestDays: "8",
  location: "Tauramena, Casanare",
  quality: "Calibre mixto, racimo seleccionado",
  access: "Camión NPR hasta punto de cargue",
  expectedPrice: "7500000",
  deadline: "Hoy, 6:00 p. m.",
  conditions: "Venta total del lote; se reciben ofertas con transporte y anticipo.",
  description:
    "Tengo plátano hartón listo en ocho días. Son cerca de dos toneladas y media en Tauramena."
};

export const buyerMatches = [
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

export const bids = [
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
    notes: "Exige clasificación adicional antes de recibir.",
    score: 74,
    buyer: {
      name: "Comercializadora del Casanare",
      zone: "Yopal, Casanare",
      contact: "Equipo de compras regional"
    }
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
    continuity: "Opción mensual",
    risk: "Bajo",
    notes: "Compra todo el lote con calibres mixtos.",
    score: 93,
    buyer: {
      name: "Distribuciones Cusiana",
      zone: "Tauramena, Casanare",
      contact: "Coordinación logística"
    }
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
    notes: "Compra 80% del lote y paga el saldo a ocho días.",
    score: 82,
    buyer: {
      name: "Mercados del Piedemonte",
      zone: "Villanueva, Casanare",
      contact: "Abastecimiento agrícola"
    }
  }
];

export const tabs = [
  { id: "finca", label: "Finca" },
  { id: "cosecha", label: "Cosecha" },
  { id: "mercado", label: "Mercado" },
  { id: "pujas", label: "Pujas" }
];
