import type { MetadataRoute } from "next";

// Web app manifest (install to home screen). Icons are generated from
// src/assets/brand/icon-green.png; the maskable one keeps the letter inside
// Android's safe zone on a full cream square.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "على مُكث",
    short_name: "على مُكث",
    description: "منصّة متابعة تسميع وحفظ الطلاب",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2e8",
    theme_color: "#3f6650",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
