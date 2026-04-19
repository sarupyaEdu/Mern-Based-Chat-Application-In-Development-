import "server-only";

const fallbackOrigin = "http://localhost:3000";
const configuredAppOrigin =
  process.env.WEBAUTHN_ORIGIN || process.env.NEXTAUTH_URL || fallbackOrigin;

function getHostname(origin: string) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
}

export const rpName = process.env.NEXT_PUBLIC_APP_NAME || "Next Chat App";
export const rpID = process.env.WEBAUTHN_RP_ID || getHostname(configuredAppOrigin);

export function getExpectedOrigins() {
  const origins = new Set<string>([fallbackOrigin, "http://127.0.0.1:3000"]);

  if (configuredAppOrigin) {
    origins.add(configuredAppOrigin);
  }

  return Array.from(origins);
}
