import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentService } from "../payment-service";

vi.mock("../stripe-config", () => ({
  getStripeInstance: vi.fn(() => ({
    paymentIntents: {
      create: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
  })),
}));

vi.mock("../supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    }),
  ),
}));

describe("PaymentService", () => {
  describe("mock provider", () => {
    let service: PaymentService;

    beforeEach(() => {
      service = new PaymentService({ provider: "mock" });
    });

    it("should process mock payment successfully", async () => {
      const result = await service.processPayment(10, "usd", "pm_mock");
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^mock_/);
    });

    it("should include error as undefined on success", async () => {
      const result = await service.processPayment(10, "usd", "pm_mock");
      expect(result.error).toBeUndefined();
    });
  });

  describe("stripe provider", () => {
    let service: PaymentService;
    let mockStripe: any;

    beforeEach(async () => {
      const { getStripeInstance } = await import("../stripe-config");
      mockStripe = {
        paymentIntents: {
          create: vi.fn(),
        },
        refunds: {
          create: vi.fn(),
        },
      };
      vi.mocked(getStripeInstance).mockReturnValue(mockStripe);
      service = new PaymentService({ provider: "stripe" });
    });

    it("should return success when payment intent succeeds", async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_123",
        status: "succeeded",
      });

      const result = await service.processPayment(50, "usd", "pm_card_visa");
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("pi_123");
    });

    it("should return failure when payment intent status is not succeeded", async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_456",
        status: "requires_action",
      });

      const result = await service.processPayment(50, "usd", "pm_card_visa");
      expect(result.success).toBe(false);
    });

    it("should return error message when stripe throws", async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error("Card declined"),
      );

      const result = await service.processPayment(50, "usd", "pm_card_visa");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Card declined");
    });

    it("should process refund successfully", async () => {
      mockStripe.refunds.create.mockResolvedValue({ id: "re_123" });

      const result = await service.refundPayment("pi_123");
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("re_123");
    });

    it("should return error when refund fails", async () => {
      mockStripe.refunds.create.mockRejectedValue(
        new Error("Refund not allowed"),
      );

      const result = await service.refundPayment("pi_123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Refund not allowed");
    });
  });

  describe("paypal provider", () => {
    let service: PaymentService;

    beforeEach(() => {
      service = new PaymentService({ provider: "paypal" });
    });

    it("should process paypal payment successfully", async () => {
      const result = await service.processPayment(20, "usd", "paypal_token");
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^paypal_/);
    });
  });
});
