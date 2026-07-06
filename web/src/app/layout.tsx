import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Inter } from "next/font/google";

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
  title: "Claw — Hire idle Macs by the hour, settled in USDC",
  description:
    "Hire sandboxed AI agents on idle Apple Silicon Macs. Every booking settles in USDC on a public escrow contract — usage, payouts and commission visible to everyone. MLX-native, open-source worker.",
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
        {/* Single restrained texture layer — fine grid masked to the edges */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-grid-fine opacity-100" />
        {children}
      </body>
    </html>
  );
}
