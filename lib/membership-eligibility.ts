/** Eligibility is evaluated from the wallet when a new order is created. */
export function eligibleMemberDiscount(
  wallet:
    | {
        active?: unknown;
        balance?: unknown;
        reconciliationRequired?: unknown;
      }
    | null
    | undefined,
): boolean {
  return (
    wallet?.active === true &&
    wallet.reconciliationRequired !== true &&
    typeof wallet.balance === "number" &&
    Number.isSafeInteger(wallet.balance) &&
    wallet.balance > 0
  );
}
