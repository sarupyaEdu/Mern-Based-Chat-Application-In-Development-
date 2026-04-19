const isProduction = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProduction
  ? "__Secure-chat.session-token"
  : "chat.session-token";

export const TWO_FACTOR_CHALLENGE_COOKIE_NAME = isProduction
  ? "__Secure-chat.2fa-token"
  : "chat.2fa-token";

export const AUTHENTICATOR_ISSUER_NAME =
  process.env.NEXT_PUBLIC_APP_NAME || "Next Chat App";
