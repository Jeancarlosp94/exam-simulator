import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { AccountToggle } from "@/components/layout/account-toggle";
import { BottomNav } from "@/components/layout/bottom-nav";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { SwRegister } from "@/components/pwa/sw-register";
import { Toaster } from "@/components/ui/sonner";
import { optionalEnv } from "@/lib/env";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

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
  appleWebApp: {
    capable: true,
    title: "Quizen",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
};

/**
 * Next 14+ separates viewport from metadata. The themeColor controls the
 * browser chrome on mobile (Safari status bar, Android URL bar).
 * maximumScale: 1 + userScalable: false prevents iOS's accidental zoom
 * on double-tap that breaks the quiz player UX.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#14b8a6" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Keep the layout intact when the on-screen keyboard opens (sign-in,
  // tutor chat input) — otherwise mobile browsers shrink the viewport
  // and our fixed bottom nav covers the focused input.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the theme cookie server-side so the first paint has the right
  // palette/mode/brightness — no flash, no client-side correction.
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const brightnessClass = theme.brightness === "dark" ? "dark" : "light";

  return (
    <html
      lang="es"
      data-palette={theme.palette}
      data-mode={theme.mode}
      className={`${brightnessClass} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-16 sm:pb-0">
        {children}
        <Toaster richColors closeButton position="top-right" />
        <ModeToggle />
        <AccountToggle />
        <BottomNav />
        <InstallPrompt />
        <SwRegister />
      </body>
    </html>
  );
}
