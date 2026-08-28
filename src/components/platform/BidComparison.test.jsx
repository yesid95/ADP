import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BidComparison } from "./BidComparison.jsx";

const listing = {
  estimatedQuantityKg: "3200.000",
  cropVariety: { name: "Plátano hartón" },
  farm: { name: "Finca El Morichal" }
};

const bids = [
  {
    id: "bid-a",
    anonymousLabel: "A",
    status: "SUBMITTED",
    terms: {
      unitPriceCopPerKg: "1900.00", offeredQuantityKg: "3200.000",
      transportIncluded: true, pickupAtFarm: true, sellerLogisticsCostCop: "0.00",
      advanceAmountCop: "1200000.00", paymentTermDays: 2, continuityMonths: null,
      netAmountCop: "6080000.00"
    }
  },
  {
    id: "bid-b",
    anonymousLabel: "B",
    status: "SUBMITTED",
    terms: {
      unitPriceCopPerKg: "2020.00", offeredQuantityKg: "3200.000",
      transportIncluded: false, pickupAtFarm: false, sellerLogisticsCostCop: "400000.00",
      advanceAmountCop: "0.00", paymentTermDays: 15, continuityMonths: null,
      netAmountCop: "6064000.00"
    }
  }
];

describe("BidComparison", () => {
  it("explains the recommendation and asks for confirmation before awarding", async () => {
    const user = userEvent.setup();
    const setPendingBidId = vi.fn();
    const { rerender } = render(<BidComparison bids={bids} busy={false} listing={listing} onAward={vi.fn()} pendingBidId={null} setPendingBidId={setPendingBidId} winner={null} />);

    expect(screen.getByText(/A lidera por/)).toBeInTheDocument();
    expect(screen.getByText("Transporte no incluido")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Revisar y adjudicar" })[0]);
    expect(setPendingBidId).toHaveBeenCalledWith("bid-a");

    rerender(<BidComparison bids={bids} busy={false} listing={listing} onAward={vi.fn()} pendingBidId="bid-a" setPendingBidId={setPendingBidId} winner={null} />);
    expect(screen.getByRole("alertdialog", { name: "¿Adjudicar a la oferta A?" })).toBeInTheDocument();
  });

  it("reveals the winner and prepares the WhatsApp closing message", () => {
    const acceptedBids = [{ ...bids[0], status: "ACCEPTED" }, { ...bids[1], status: "REJECTED" }];
    render(<BidComparison bids={acceptedBids} busy={false} listing={listing} onAward={vi.fn()} pendingBidId={null} setPendingBidId={vi.fn()} winner={{ businessName: "Distribuciones Cusiana", email: "comprador@adp.local", phone: "+573105551212" }} />);

    expect(screen.getByText("Negociación adjudicada")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Cerrar por WhatsApp/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/573105551212?text="));
  });
});
