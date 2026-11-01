export type PaymentStatus =
  "creating" | "pending" | "paid" | "expired" | "failed" | "cancelled";

// This is the only payment metadata returned to customer and tracking screens.
export type PaymentSummary = {
  provider: "midtrans";
  attemptId: string;
  status: PaymentStatus;
  amount: number;
  environment: "sandbox" | "production";
  expiresAt: string;
  paidAt?: string;
};

export type PaymentView = {
  revision: number;
  enabled: boolean;
  orderId: string;
  paid: boolean;
  amount: number;
  ready: boolean;
  payment?: PaymentSummary;
  qrUrl?: string;
  reviewRequired?: boolean;
  branchId: string;
  bank: import("./manual-types").BankDetails;
  manual?: import("./manual-types").ManualPaymentSummary;
};

export type PaymentAttempt = PaymentSummary & {
  orderId: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
  transactionId?: string;
  qrUrl?: string;
  lastCheckedAt?: number;
  requestedAt?: string;
  providerState?: string;
  reconciliationRequired?: boolean;
};

export type ProviderTransaction = {
  order_id: string;
  gross_amount: string;
  transaction_status: string;
  transaction_id: string;
  payment_type: string;
  status_code: string;
  currency?: string;
  fraud_status?: string;
  merchant_id?: string;
  signature_key?: string;
  settlement_time?: string;
  expiry_time?: string;
  actions?: { name: string; method: string; url: string }[];
};
