import type { NextConfig } from "next";

// The site's main address. Vercel's automatic project URL can't be set to
// redirect in the Domains settings, so it's redirected here instead.
const MAIN_ORIGIN = "https://alamukth.vercel.app";

const nextConfig: NextConfig = {
  // `next dev` only: lets a phone on the same Wi-Fi open the dev server by
  // the laptop's LAN address (dev resources are blocked for other hosts by
  // default). Ignored by production builds.
  allowedDevOrigins: ["192.168.8.84"],
  async redirects() {
    return [
      {
        // exactly this host (dots escaped, so no look-alike host matches);
        // preview deployment URLs have different hosts and are unaffected
        source: "/:path*",
        has: [{ type: "host", value: "namaa-monanaddaf3-7300\\.vercel\\.app" }],
        destination: `${MAIN_ORIGIN}/:path*`,
        permanent: true, // 308: permanent, keeps the request method
      },
    ];
  },
};

export default nextConfig;
