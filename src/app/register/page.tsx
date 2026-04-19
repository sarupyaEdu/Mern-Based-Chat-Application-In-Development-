"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isStrongPassword, passwordSchemaRule } from "@/lib/auth-constants";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password.trim()
    ) {
      setMessage("All fields are required");
      return;
    }

    if (!isStrongPassword(form.password)) {
      setMessage(passwordSchemaRule);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        const fieldErrors = data?.errors?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const validationMessage = fieldErrors
          ? Object.values(fieldErrors).flat().find(Boolean)
          : "";

        setMessage(validationMessage || data.message || "Registration failed");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        identifier: form.email.trim().toLowerCase(),
      });

      if (data.devOtp) {
        params.set("devOtp", data.devOtp);
      }

      router.push(`/verify-email?${params.toString()}`);
    } catch {
      setMessage("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-2 text-3xl font-bold">Create account</h1>
        <p className="mb-6 text-sm text-zinc-400">Register to start chatting</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Enter your name"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            required
            minLength={2}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <input
            type="tel"
            name="phone"
            placeholder="Enter your phone number"
            value={form.phone}
            onChange={handleChange}
            autoComplete="tel"
            required
            minLength={8}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <p className="text-xs text-zinc-500">{passwordSchemaRule}</p>

          <button
            type="submit"
            disabled={
              loading ||
              !form.name.trim() ||
              !form.email.trim() ||
              !form.phone.trim() ||
              !form.password.trim()
            }
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Register"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}

        <p className="mt-6 text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
