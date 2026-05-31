import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { optionalEnv } from "@/lib/env";

import "./globals.css";

const APP_URL = optionalEnv("NEXT_PUBLIC_APP_URL", "https://quizen.app");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Quizen — Sube tu PDF. Estudia con calma.",
    template: "%s · Quizen",
  },
  description:
    "Sube cualquier PDF y la IA arma cuestionarios de estudio adaptados a tu material. Niveles de Bloom mixtos, tutor socrático, repaso espaciado.",
  applicationName: "Quizen",
  authors: [{ name: "Quizen" }],
  keywords: [
    "quiz",
    "PDF",
    "estudio",
    "IA",
    "Claude",
    "Bloom",
    "repetición espaciada",
    "SRS",
    "tutor",
  ],
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "Quizen",
    title: "Quizen — Sube tu PDF. Estudia con calma.",
    description:
      "Sube cualquier PDF y la IA arma cuestionarios de estudio adaptados a tu material.",
    locale: "es_EC",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quizen — Sube tu PDF. Estudia con calma.",
    description:
      "Sube cualquier PDF y la IA arma cuestionarios de estudio adaptados a tu material.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
