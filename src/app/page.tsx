import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">MERN Chat App</h1>
        <p className="mt-3 text-zinc-400">
          Next.js + TypeScript + MongoDB + Socket.IO
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black"
          >
            Register
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
