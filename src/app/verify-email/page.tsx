"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState(
    searchParams.get("identifier") || searchParams.get("email") || "",
  );
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [devOtp, setDevOtp] = useState(searchParams.get("devOtp") || "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verifyEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!identifier.trim() || !otp.trim()) {
      setMessage("Email/phone and OTP are required");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/verify-email/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          otp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to verify email");
        return;
      }

      setMessage(data.message || "Email verified");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setMessage("Failed to verify email");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!identifier.trim()) {
      setMessage("Email or phone number is required");
      return;
    }

    try {
      setResending(true);
      setMessage("");

      const res = await fetch("/api/verify-email/request", {
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
        setMessage(data.message || "Failed to resend OTP");
        return;
      }

      setDevOtp(data.devOtp || "");
      setMessage(data.message || "OTP resent");
    } catch {
      setMessage("Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-2 text-3xl font-bold">Verify email</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Enter the OTP sent to your account email to activate your account.
        </p>

        <form onSubmit={verifyEmail} className="space-y-4">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter your email or phone number"
            autoComplete="username"
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit OTP"
            inputMode="numeric"
            maxLength={6}
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
          />

          {devOtp && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Dev OTP: <span className="font-semibold">{devOtp}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !identifier.trim() || !otp.trim()}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify email"}
          </button>
        </form>

        <button
          type="button"
          onClick={resendOtp}
          disabled={resending || !identifier.trim()}
          className="mt-4 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {resending ? "Sending..." : "Resend OTP"}
        </button>

        {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}

        <p className="mt-6 text-sm text-zinc-400">
          Already verified?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
