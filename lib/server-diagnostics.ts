// Only predefined labels reach logs: upstream errors may contain credentials or customer data.
export function serverFailure(error: unknown) {
  const value = error as { code?: unknown; message?: unknown } | null;
  const code = value?.code;
  const message = typeof value?.message === "string" ? value.message : "";
  const knownCodes = new Set([
    "app/invalid-credential", "app/invalid-app-options", "app/invalid-argument",
    "auth/invalid-credential", "ERR_OSSL_UNSUPPORTED", "ERR_REQUIRE_ESM",
    "MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND", "ENOTFOUND", "ECONNREFUSED",
    "ETIMEDOUT", "UNAUTHENTICATED", "PERMISSION_DENIED", "NOT_FOUND",
    "FAILED_PRECONDITION", "UNAVAILABLE", "DEADLINE_EXCEEDED",
  ]);
  const safeCode = typeof code === "number" && Number.isInteger(code) && code >= 0 && code <= 16
    ? code : typeof code === "string" && knownCodes.has(code) ? code : "unknown";
  let reason = "unclassified";
  if (/FIREBASE_NOT_CONFIGURED/.test(message)) reason = "firebase_environment_missing";
  else if (/private.key|PEM|DECODER routines|Invalid key format/i.test(message)) reason = "firebase_private_key_invalid";
  else if (/invalid_grant|Invalid JWT Signature|invalid.*credential|UNAUTHENTICATED/i.test(message) || code === 16) reason = "firebase_credentials_rejected";
  else if (/PERMISSION_DENIED|insufficient permissions/i.test(message) || code === 7) reason = "firestore_permission_denied";
  else if (/index/i.test(message) && code === 9) reason = "firestore_index_required";
  else if (/database.*not exist/i.test(message) || code === 5) reason = "firestore_database_not_found";
  else if (code === "ERR_REQUIRE_ESM") reason = "dependency_module_format";
  else if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") reason = "dependency_missing";
  else if (code === 4 || code === 14 || code === "ENOTFOUND" || code === "ETIMEDOUT") reason = "firebase_connection_failed";
  return { code: safeCode, reason };
}
