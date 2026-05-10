import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Inter } from "next/font/google";

import { ClawMascot } from "@/components/claw/ClawMascot";

import "./globals.css";

const bodySans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Claw — Hire idle Macs by the hour",
  description:
    "Hire sandboxed AI agents on idle Apple Silicon Macs. Suppliers earn from compute that would otherwise sit idle. Trust-but-verify, MLX-native, open-source worker.",
  metadataBase: new URL("https://claw.dev"),
  openGraph: {
    title: "Claw Marketplace",
    description: "Idle Macs, hired by the hour.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${bricolage.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="bg-background text-foreground min-h-svh flex flex-col relative overflow-x-hidden">
        {/* atmospheric layers — fixed so they cover the viewport */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-grid-dots opacity-40" />
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-scanlines opacity-30" />
        {children}
        <ClawMascot />
      </body>
    </html>
  );
}
