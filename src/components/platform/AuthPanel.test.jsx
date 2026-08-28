import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel.jsx";

describe("registro de cuenta", () => {
  it("normaliza un celular colombiano de diez dígitos a E.164", async () => {
    const user = userEvent.setup();
    const client = {
      request: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
      login: vi.fn()
    };

    render(
      <AuthPanel client={client} initialNotice="" onAuthenticated={vi.fn()} />
    );

    await user.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    await user.type(screen.getByLabelText("Nombre visible"), "Yesid");
    await user.type(screen.getByLabelText("Correo"), "yesid@example.test");
    await user.type(screen.getByLabelText("Teléfono (opcional)"), "3123902469");
    await user.type(
      screen.getByLabelText("Contraseña (mínimo 12 caracteres)"),
      "Una-Clave-Segura-2026!"
    );
    await user.click(screen.getByRole("button", { name: "Crear y verificar cuenta" }));

    await waitFor(() => expect(client.request).toHaveBeenCalledTimes(1));
    expect(client.request).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      body: {
        displayName: "Yesid",
        email: "yesid@example.test",
        phone: "+573123902469",
        password: "Una-Clave-Segura-2026!",
        roles: ["FARMER"]
      }
    });
  });
});
