import { farmer } from "../data/demoData.js";

const requiredFields = {
  crop: "Tipo de cultivo",
  quantity: "Cantidad",
  harvestDays: "Disponibilidad",
  location: "Ubicación",
  quality: "Calidad",
  access: "Acceso vial",
  expectedPrice: "Precio esperado",
  deadline: "Cierre de pujas",
  conditions: "Condiciones",
  description: "Descripción"
};

export function currency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

export function listingTitle(listing) {
  return `${listing.quantity || "0"} toneladas de ${String(listing.crop || "cosecha").toLocaleLowerCase("es-CO")}`;
}

export function validateListing(listing, photos) {
  const errors = {};

  Object.entries(requiredFields).forEach(([field, label]) => {
    if (!String(listing[field] ?? "").trim()) {
      errors[field] = `${label} es obligatorio.`;
    }
  });

  if (Number(listing.quantity) <= 0) {
    errors.quantity = "La cantidad debe ser mayor que cero.";
  }
  if (!Number.isInteger(Number(listing.harvestDays)) || Number(listing.harvestDays) < 0) {
    errors.harvestDays = "Indica un número entero de días igual o mayor que cero.";
  }
  if (Number(listing.expectedPrice) <= 0) {
    errors.expectedPrice = "El precio esperado debe ser mayor que cero.";
  }
  if (listing.description.trim().length < 20) {
    errors.description = "La descripción debe tener al menos 20 caracteres.";
  }
  if (!photos.length) {
    errors.photos = "Agrega al menos una fotografía de la cosecha.";
  }

  return errors;
}

export function validateAiFields(listing) {
  const aiFields = ["crop", "quantity", "harvestDays", "location", "quality", "access", "expectedPrice", "conditions"];
  return aiFields.reduce((errors, field) => {
    if (!String(listing[field] ?? "").trim()) {
      errors[field] = `${requiredFields[field]} hace falta para mejorar el texto.`;
    }
    return errors;
  }, {});
}

export function buildAiSuggestion(listing) {
  const access = `${listing.access.charAt(0).toLocaleLowerCase("es-CO")}${listing.access.slice(1)}`;
  return `${farmer.farm} ofrece ${listing.quantity} toneladas de ${listing.crop.toLowerCase()} en ${listing.location}, disponibles para cosecha en ${listing.harvestDays} días. El lote cuenta con ${listing.quality.toLowerCase()}, ${access} y un precio esperado de ${currency(listing.expectedPrice)}. ${listing.conditions} Se reciben pujas con condiciones claras de transporte, anticipo y fecha de pago.`;
}

export function buildWhatsAppUrl(number, message) {
  const sanitizedNumber = String(number ?? "").replace(/\D/g, "");
  const baseUrl = sanitizedNumber ? `https://wa.me/${sanitizedNumber}` : "https://wa.me/";
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppMessage(listing, bid) {
  return `Hola, ${bid.buyer.name}. Soy ${farmer.owner} de ${farmer.farm}. Acepté la oferta del ${bid.label} por ${listingTitle(listing)}, con precio bruto de ${currency(bid.gross)} y valor neto estimado de ${currency(bid.net)}. Quisiera coordinar la recogida y el cierre de la negociación.`;
}
