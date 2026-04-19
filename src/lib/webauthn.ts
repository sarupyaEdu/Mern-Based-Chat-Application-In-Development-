import "server-only";

const fallbackOrigin = "http://localhost:3000";

export const rpName = process.env.NEXT_PUBLIC_APP_NAME || "Next Chat App";
export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";

export function getExpectedOrigins() {
  const configured = process.env.WEBAUTHN_ORIGIN;
  const origins = new Set<string>([fallbackOrigin, "http://127.0.0.1:3000"]);

  if (configured) {
    origins.add(configured);
  }

  return Array.from(origins);
}
