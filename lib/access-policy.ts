export function adminEmailAllowed(
  email: string,
  verified: boolean,
  allowlist: string,
) {
  if (!verified || !email.trim()) return false;
  const entries = allowlist
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return entries.includes(email.trim().toLowerCase());
}
