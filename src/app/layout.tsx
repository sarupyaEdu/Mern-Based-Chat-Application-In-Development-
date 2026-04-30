import type { Metadata } from "next";
import "./globals.css";
import AuthSessionProvider from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Next.js Chat App",
  description: "Real-time chat app with Next.js, MongoDB and Socket.IO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
