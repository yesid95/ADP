import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

async function openPublicationForm(user) {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Cosecha" }));
}

async function publishDefaultListing(user) {
  await openPublicationForm(user);
  await user.click(screen.getByRole("button", { name: /Publicar cosecha/i }));
  expect(screen.getByText("Vista pública de la cosecha")).toBeInTheDocument();
}

describe("demo navegable de Fase 1", () => {
  it("mantiene mercado y pujas en espera antes de publicar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Mercado" }));
    expect(screen.getByRole("heading", { name: "El mercado espera tu publicación" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pujas" }));
    expect(screen.getByRole("heading", { name: "Todavía no hay pujas" })).toBeInTheDocument();
  });

  it("genera y aplica una sugerencia usando los datos editados", async () => {
    const user = userEvent.setup();
    await openPublicationForm(user);
    const quantity = screen.getByRole("spinbutton", { name: "Cantidad (toneladas)" });

    await user.clear(quantity);
    await user.type(quantity, "3");
    await user.click(screen.getByRole("button", { name: /Mejorar con IA simulada/i }));

    expect(screen.getByText(/ofrece 3 toneladas de plátano hartón/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usar texto mejorado" }));
    expect(screen.getByRole("textbox", { name: "Descripción de la cosecha" }).value).toContain("3 toneladas");
  });

  it("valida las fotografías y admite una carga local temporal", async () => {
    const user = userEvent.setup();
    await openPublicationForm(user);

    await user.click(screen.getByRole("button", { name: /Eliminar Racimo/i }));
    await user.click(screen.getByRole("button", { name: /Eliminar Plátano hartón listo/i }));
    await user.click(screen.getByRole("button", { name: /Publicar cosecha/i }));
    expect(screen.getByText("Agrega al menos una fotografía de la cosecha.")).toBeInTheDocument();

    const file = new File(["plantain"], "mi-platano.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText("Agregar fotos"), file);
    expect(screen.getByRole("img", { name: "mi-platano.webp" })).toBeInTheDocument();
  });

  it("publica la cosecha y habilita compradores y tres pujas", async () => {
    const user = userEvent.setup();
    await publishDefaultListing(user);

    await user.click(screen.getByRole("button", { name: "Mercado" }));
    expect(screen.getByText("3 coincidencias")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pujas" }));
    expect(screen.getAllByRole("button", { name: /Aceptar puja/i })).toHaveLength(3);
    expect(screen.getByText("Recomendación: Pujador B")).toBeInTheDocument();
    expect(screen.queryByText("Distribuciones Cusiana")).not.toBeInTheDocument();
  });

  it("confirma una sola puja, revela al ganador y genera el cierre por WhatsApp", async () => {
    const user = userEvent.setup();
    await publishDefaultListing(user);
    await user.click(screen.getByRole("button", { name: "Pujas" }));

    const recommendedCard = screen.getByText("Pujador B").closest("article");
    await user.click(within(recommendedCard).getByRole("button", { name: /Aceptar puja/i }));
    expect(screen.getByRole("dialog", { name: "¿Aceptar la oferta del Pujador B?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar aceptación" }));

    expect(screen.getAllByText("Distribuciones Cusiana").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Puja aceptada|Proceso cerrado/i })).toHaveLength(3);
    const whatsapp = screen.getByRole("link", { name: "Abrir WhatsApp" });
    expect(whatsapp).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/\?text=/));
    expect(decodeURIComponent(whatsapp.getAttribute("href"))).toContain("Distribuciones Cusiana");
  });

  it("reinicia por completo una negociación aceptada", async () => {
    const user = userEvent.setup();
    await publishDefaultListing(user);
    await user.click(screen.getByRole("button", { name: "Pujas" }));
    await user.click(screen.getAllByRole("button", { name: /Aceptar puja/i })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar aceptación" }));
    await user.click(screen.getAllByRole("button", { name: "Reiniciar demo" })[0]);

    expect(screen.getByText("Publicación en borrador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finca" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Comprador ganador")).not.toBeInTheDocument();
  });
});
