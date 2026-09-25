import type { NextConfig } from "next";
import path from "path";

// Optional x402 payment modules pulled in by the Coinbase CDP SDK through wagmi's
// Base Account connector. Dayzro never uses them, so they resolve to empty modules.
const UNUSED_OPTIONAL_MODULES = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(UNUSED_OPTIONAL_MODULES.map((m) => [m, false])),
    };
    return config;
  },
  sassOptions: {
    additionalData: `
      @import "app/scss/vars.scss";
      @import "app/scss/mixins.scss";
    `,
    includePaths: [path.join(__dirname, "src")],
    silenceDeprecations: ["import", "legacy-js-api"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
