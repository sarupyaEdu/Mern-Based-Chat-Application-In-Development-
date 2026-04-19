export const GENERIC_AUTH_ERROR = "Invalid email/phone or password";
export const EMAIL_NOT_VERIFIED_ERROR = "EMAIL_NOT_VERIFIED";

export const passwordSchemaRule =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";

export function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}
