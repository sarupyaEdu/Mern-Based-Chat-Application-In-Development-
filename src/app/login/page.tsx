"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  browserSupportsWebAuthnAutofill,
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useAuth } from "@/components/providers/SessionProvider";
import { EMAIL_NOT_VERIFIED_ERROR } from "@/lib/auth-constants";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useAuth();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
    rememberMe: false,
  });
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<
    "authenticator" | "email"
  >("authenticator");
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingPasskey, setLoadingPasskey] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyAutofillSupported, setPasskeyAutofillSupported] = useState(false);
  const [message, setMessage] = useState("");
  const callbackUrl = searchParams.get("callbackUrl") || "/chat";
  const attemptedConditionalPasskeyRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const supported = browserSupportsWebAuthn();
      const supportsConditionalMediation =
        typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined" &&
        typeof (
          window.PublicKeyCredential as typeof PublicKeyCredential & {
            isConditionalMediationAvailable?: () => Promise<boolean>;
          }
        ).isConditionalMediationAvailable === "function";

      setPasskeySupported(supported);

      if (!supported || !supportsConditionalMediation) {
        setPasskeyAutofillSupported(false);
        return;
      }

      try {
        setPasskeyAutofillSupported(await browserSupportsWebAuthnAutofill());
      } catch {
        setPasskeyAutofillSupported(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (
      !passkeyAutofillSupported ||
      requiresTwoFactor ||
      attemptedConditionalPasskeyRef.current
    ) {
      return;
    }

    attemptedConditionalPasskeyRef.current = true;

    void (async () => {
      try {
        const optionsRes = await fetch("/api/auth/passkey/options", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            rememberMe: form.rememberMe,
          }),
        });
        const optionsData = await optionsRes.json();

        if (!optionsRes.ok || !optionsData.options) {
          return;
        }

        const authenticationResponse = await startAuthentication(
          optionsData.options,
          true,
        );
        const verifyRes = await fetch("/api/auth/passkey/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(authenticationResponse),
        });
        await verifyRes.json();

        if (!verifyRes.ok) {
          return;
        }

        await refreshSession();
        router.push(callbackUrl);
      } catch {
        // Ignore conditional UI cancellation so manual login remains available
      }
    })();
  }, [
    callbackUrl,
    form.rememberMe,
    passkeyAutofillSupported,
    refreshSession,
    requiresTwoFactor,
    router,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value =
      e.target instanceof HTMLInputElement && e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value;
    setForm((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (requiresTwoFactor) {
      if (twoFactorCode.trim().length !== 6) {
        setMessage(
          twoFactorMethod === "email"
            ? "Enter the 6-digit code sent to your email"
            : "Enter the 6-digit code from your authenticator app",
        );
        return;
      }

      setLoading(true);
      setMessage("");

      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          otp: twoFactorCode.trim(),
          method: twoFactorMethod,
        }),
      });
      const result = await res.json();

      setLoading(false);

      if (!res.ok) {
        setMessage(
          result.message ||
            (twoFactorMethod === "email"
              ? "Invalid email OTP"
              : "Invalid authenticator code"),
        );
        if (res.status === 401 || res.status === 429) {
          setRequiresTwoFactor(false);
          setTwoFactorCode("");
          setTwoFactorMethod("authenticator");
        }
        return;
      }

      await refreshSession();
      router.push(callbackUrl);
      return;
    }

    if (!form.identifier.trim() || !form.password.trim()) {
      setMessage("Phone/email and password are required");
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
        credentials: "include",
        body: JSON.stringify({
          identifier: form.identifier,
          password: form.password,
          rememberMe: form.rememberMe,
        }),
      });
    const result = await res.json();

    setLoading(false);

    if (!res.ok) {
      if (result.message === EMAIL_NOT_VERIFIED_ERROR) {
        router.push(
          `/verify-email?identifier=${encodeURIComponent(form.identifier.trim())}`,
        );
        return;
      }

      setMessage(result.message || "Invalid phone/email or password");
      return;
    }

    if (result.twoFactorRequired) {
      setRequiresTwoFactor(true);
      setTwoFactorMethod("authenticator");
      setTwoFactorCode("");
      setMessage(result.message || "Enter the code from your authenticator app");
      return;
    }

    await refreshSession();
    router.push(callbackUrl);
  };

  const handlePasskeyLogin = async () => {
    try {
      setLoadingPasskey(true);
      setMessage("");

      const optionsRes = await fetch("/api/auth/passkey/options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          rememberMe: form.rememberMe,
        }),
      });
      const optionsData = await optionsRes.json();

      if (!optionsRes.ok || !optionsData.options) {
        setMessage(optionsData.message || "Failed to start passkey sign-in");
        return;
      }

      const authenticationResponse = await startAuthentication(optionsData.options);
      const verifyRes = await fetch("/api/auth/passkey/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(authenticationResponse),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setMessage(verifyData.message || "Passkey sign-in failed");
        return;
      }

      await refreshSession();
      router.push(callbackUrl);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Passkey sign-in was cancelled",
      );
    } finally {
      setLoadingPasskey(false);
    }
  };

  const requestEmailTwoFactorOtp = async () => {
    setSendingEmailOtp(true);
    setMessage("");

    const res = await fetch("/api/auth/2fa/email", {
      method: "POST",
      credentials: "include",
    });
    const result = await res.json();

    setSendingEmailOtp(false);

    if (!res.ok) {
      setMessage(result.message || "Failed to send login OTP");
      return;
    }

    setTwoFactorMethod("email");
    setTwoFactorCode("");
    setMessage(result.devOtp ? `${result.message} DEV OTP: ${result.devOtp}` : result.message);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-2 text-3xl font-bold">Welcome back</h1>
        <p className="mb-6 text-sm text-zinc-400">
          {requiresTwoFactor
            ? twoFactorMethod === "email"
              ? "Enter the email OTP to finish signing in"
              : "Enter your authenticator app code to finish signing in"
            : "Login to continue"}
        </p>
        {!requiresTwoFactor && passkeySupported && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {passkeyAutofillSupported
              ? "This device can offer passkey sign-in automatically."
              : "This device supports passkey sign-in."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {requiresTwoFactor ? (
            <>
              <input
                type="text"
                name="otp"
                placeholder={
                  twoFactorMethod === "email"
                    ? "Enter 6-digit email OTP"
                    : "Enter 6-digit authenticator code"
                }
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  void requestEmailTwoFactorOtp();
                }}
                disabled={sendingEmailOtp || twoFactorMethod === "email"}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-semibold text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:opacity-60"
              >
                {sendingEmailOtp
                  ? "Sending email OTP..."
                  : twoFactorMethod === "email"
                  ? "Email OTP active"
                  : "Use email OTP instead"}
              </button>
              {twoFactorMethod === "email" && (
                <button
                  type="button"
                  onClick={() => {
                    void requestEmailTwoFactorOtp();
                  }}
                  disabled={sendingEmailOtp}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-semibold text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:opacity-60"
                >
                  {sendingEmailOtp ? "Resending..." : "Resend email OTP"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setTwoFactorCode("");
                  setTwoFactorMethod("authenticator");
                  setMessage("");
                }}
                className="w-full rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-100"
              >
                Use different credentials
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                name="identifier"
                placeholder="Enter your email or phone number"
                value={form.identifier}
                onChange={handleChange}
                autoComplete="username webauthn"
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
                minLength={8}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
              />
              <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={form.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                Keep me signed in on this device
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              (requiresTwoFactor
                ? twoFactorCode.trim().length !== 6
                : !form.identifier.trim() || !form.password.trim())
            }
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading
              ? requiresTwoFactor
                ? "Verifying..."
                : "Signing in..."
              : requiresTwoFactor
                ? twoFactorMethod === "email"
                  ? "Verify email OTP"
                  : "Verify code"
                : "Login"}
          </button>
          {!requiresTwoFactor && passkeySupported && (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={loadingPasskey}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-semibold text-zinc-100 transition hover:border-emerald-500 hover:text-white disabled:opacity-60"
            >
              {loadingPasskey ? "Opening passkey..." : "Use passkey / device"}
            </button>
          )}
        </form>

        {!requiresTwoFactor && (
          <div className="mt-4 text-right">
            <Link href="/forgot-password" className="text-sm text-emerald-400 hover:underline">
              Forgot password?
            </Link>
          </div>
        )}

        {message && (
          <p className="mt-4 text-sm text-red-400">{message}</p>
        )}

        <p className="mt-6 text-sm text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-emerald-400 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <p className="text-sm text-zinc-400">Loading login...</p>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
