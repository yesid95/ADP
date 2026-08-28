import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlatformApp } from "./PlatformApp.jsx";

const listing = {
  id: "listing-1",
  status: "OPEN",
  estimatedQuantityKg: "1250.000",
  expectedPriceCopPerKg: "1950.00",
  bidDeadlineAt: "2026-08-29T10:03:00.000Z",
  cropVariety: { name: "Plátano hartón" },
  farm: { name: "Finca El Recuerdo", publicLocationText: "Yopal" }
};

describe("plataforma persistente", () => {
  it("recarga el mercado al restaurar una sesión compradora y al actualizar", async () => {
    const user = userEvent.setup();
    let listingRequests = 0;
    const client = {
      hasStoredSession: () => true,
      bootstrap: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn(),
      logout: vi.fn(),
      request: vi.fn(async (path) => {
        if (path === "/catalogs") return { data: { departments: [], crops: [] } };
        if (path === "/me") {
          return {
            data: {
              displayName: "Comprador QA",
              contact: { email: "buyer@example.com" },
              roles: ["BUYER"]
            }
          };
        }
        if (path === "/me/bids?limit=100") return { data: [] };
        if (path === "/listings?limit=100") {
          listingRequests += 1;
          return { data: listingRequests === 1 ? [] : [listing] };
        }
        throw new Error(`Unexpected request: ${path}`);
      })
    };

    render(<PlatformApp client={client} onOpenDemo={() => {}} />);

    expect(await screen.findByRole("heading", { name: "Plátano hartón" })).toBeInTheDocument();
    expect(listingRequests).toBe(2);

    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(listingRequests).toBe(3));
  });
});
