export type BankAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export type BankDetails = BankAccount & {
  configured: boolean;
  qrUrl?: string;
  version?: string;
};

export type BankSnapshot = BankAccount & {
  version?: string;
  qrVersion?: string;
};

export type ManualPaymentSummary = {
  method: "bank_transfer";
  status: "unpaid" | "awaiting_review" | "paid" | "rejected";
  amount: number | null;
  hasProof: boolean;
  proofVersion?: string;
  submittedAt?: string;
  confirmedAt?: string;
  rejectionReason?: string;
  bank?: BankSnapshot;
};

// These records are server-only and never returned as part of an order.
export type ManualProof = {
  version: string;
  path: string;
  uploadedAt: string;
};

export type ManualPaymentRecord = ManualPaymentSummary & {
  orderId: string;
  proofPath?: string;
  confirmationSource?: "customer_proof" | "admin_dashboard";
  rejectedProofVersion?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

export type StoredBankSettings = BankAccount & {
  version?: string;
  qrVersion?: string;
};
