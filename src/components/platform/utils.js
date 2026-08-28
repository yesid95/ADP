import { ApiError } from "../../lib/api.js";

export const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export function errorMessage(error) {
  if (error instanceof ApiError) {
    return `${error.message}${error.requestId ? ` · referencia ${error.requestId}` : ""}`;
  }
  return "No fue posible conectar con la API. Revisa que el backend esté activo.";
}

export function isoDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}
