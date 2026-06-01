import type { MetadataRoute } from "next";

/**
 * PWA manifest — auto-served at /manifest.webmanifest.
 *
 * Browsers fire the "install" prompt when manifest + service worker +
 * HTTPS are all present and the site has been visited a couple times.
 * Vercel handles HTTPS; sw.js lives in /public; this file is the third
 * leg of the tripod.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quizen — Estudia con calma",
    short_name: "Quizen",
    description:
      "Sube tu PDF. La IA arma cuestionarios adaptados a tu material.",
    start_url: "/library",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#14b8a6",
    lang: "es-EC",
    dir: "ltr",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Subir PDF",
        short_name: "Subir",
        description: "Subir un nuevo documento",
        url: "/upload",
      },
      {
        name: "Repasar",
        short_name: "Repaso",
        description: "Cards listas para repasar",
        url: "/review",
      },
    ],
  };
}
