export function adminEmailAllowed(
  email: string,
  verified: boolean,
  allowlist: string,
) {
  if (!verified || !email.trim()) return false;
  return allowlist
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
export type AccessRole = "owner" | "admin" | "staff" | "customer";
export function resolveAccess(
  email: string,
  verified: boolean,
  provider: string,
  assigned: unknown,
  allowlist: string,
) {
  const owner = adminEmailAllowed(email, verified, allowlist);
  const role: AccessRole = owner
    ? "owner"
    : assigned === "admin" || assigned === "staff"
      ? assigned
      : "customer";
  const dashboard = verified && provider === "password" && role !== "customer";
  return {
    role,
    dashboard,
    manageUsers: dashboard && (role === "owner" || role === "admin"),
  };
}
