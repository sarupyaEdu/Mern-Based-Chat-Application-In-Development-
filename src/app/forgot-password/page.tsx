"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { passwordSchemaRule } from "@/lib/auth-constants";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [devOtp, setDevOtp] = useState("");

  const requestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!identifier.trim()) {
      setMessage("Email or phone number is required");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/forgot-password/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to send OTP");
        return;
      }

      setDevOtp(data.devOtp || "");
      setMessage(data.message || "OTP sent");
      setStep("reset");
    } catch {
      setMessage("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!otp.trim() || !password.trim() || !confirmPassword.trim()) {
      setMessage("OTP and both password fields are required");
      return;
    }

    if (password.length < 8) {
      setMessage(passwordSchemaRule);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/forgot-password/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          otp,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to reset password");
        return;
      }

      setMessage(data.message || "Password reset successful");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setMessage("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-2 text-3xl font-bold">Forgot password</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Enter your email or phone number. OTP will be sent to your account email.
        </p>

        {step === "request" ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <input
              type="text"
              placeholder="Enter your email or phone number"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
            />

            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or phone number"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-zinc-500">{passwordSchemaRule}</p>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
            />

            {devOtp && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Dev OTP: <span className="font-semibold">{devOtp}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                !identifier.trim() ||
                !otp.trim() ||
                !password.trim() ||
                !confirmPassword.trim()
              }
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOtp("");
                setPassword("");
                setConfirmPassword("");
                setMessage("");
                setStep("request");
              }}
              className="w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-100 transition hover:bg-zinc-800"
            >
              Request a new OTP
            </button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}

        <p className="mt-6 text-sm text-zinc-400">
          Remembered your password?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
