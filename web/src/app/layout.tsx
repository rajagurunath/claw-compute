import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-svh flex flex-col">
        {children}
      </body>
    </html>
  );
}
