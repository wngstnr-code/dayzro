import type { Metadata, Viewport } from "next";
import { Providers } from "../providers";
import "swiper/css";
import "../scss/index.scss";

const FONT_PRELOADS = [
  "/fonts/ClashDisplay-Medium.woff2",
  "/fonts/ClashDisplay-Semibold.woff2",
  "/fonts/ClashGrotesk-Medium.woff2",
  "/fonts/ClashGrotesk-Semibold.woff2",
  "/fonts/Gilroy-Medium.woff2",
  "/fonts/HelveticaNeueCyr-Medium.woff2",
  "/fonts/Onest-Medium.woff2",
  "/fonts/PublicSans-Medium.woff2",
  "/fonts/PublicSans-Regular.woff2",
  "/fonts/PublicSans-SemiBold.woff2",
];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dayzro.vercel.app";
const TITLE = "Dayzro: get paid on day zero";
const DESCRIPTION =
  "Buyer-accepted invoices as onchain receivables on Arc. Sell an invoice and receive USDC in under a second.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Dayzro",
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Dayzro",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  keywords: ["Dayzro", "invoice financing", "supply chain finance", "receivables", "USDC", "EURC", "Arc", "Circle"],
  alternates: {
    canonical: SITE_URL,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {FONT_PRELOADS.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
