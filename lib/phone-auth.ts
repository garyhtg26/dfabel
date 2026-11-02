import { normalizePhone } from "./pricing";

const PHONE_EMAIL = /^wa-(628\d{7,12})@accounts\.dfable\.invalid$/;

export function phoneLoginEmail(value: string) {
  const phone = normalizePhone(value.trim());
  if (!/^\+628\d{7,12}$/.test(phone)) return null;
  return `wa-${phone.slice(1)}@accounts.dfable.invalid`;
}

export function phoneFromLoginEmail(email?: string | null) {
  const match = PHONE_EMAIL.exec((email || "").toLowerCase());
  return match ? `+${match[1]}` : null;
}

export function isPhoneLogin(
  email: string | null | undefined,
  provider: string | null | undefined,
  claim: unknown,
) {
  return (
    provider === "password" && claim === true && !!phoneFromLoginEmail(email)
  );
}
