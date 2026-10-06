export type AuthScope = "customer" | "admin";
export const authAppName = (scope: AuthScope) => `dfable-${scope}`;
export function accountName(
  user: { displayName?: string | null; email?: string | null } | null,
) {
  return user
    ? user.displayName?.trim() || user.email?.split("@")[0] || "Akun saya"
    : "";
}
export function emailScope(params: {
  scope?: string;
  continueUrl?: string;
}): AuthScope {
  if (params.scope === "admin") return "admin";
  try {
    return new URL(params.continueUrl || "").searchParams.get("scope") ===
      "admin"
      ? "admin"
      : "customer";
  } catch {
    return "customer";
  }
}
