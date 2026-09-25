import type { Metadata, Viewport } from "next";
import "@/dapp/styles/app.css";
import { themeInitScript } from "@/dapp/lib/theme";
import { Providers } from "./providers";

export const metadata: Metadata = {
    title: "Dayzro App",
    description: "Get paid on day zero. Buyer-accepted invoices on Arc.",
};

export const viewport: Viewport = { width: "device-width" };

// Separate root layout: moving between the landing page and /app is a full page load,
// so the app's Tailwind/daisyUI reset never touches the landing page styles.
export default function AppRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" data-theme="dark" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@100;400;700&display=swap"
                    rel="stylesheet"
                />
                <link href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@200,600&display=swap" rel="stylesheet" />
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body suppressHydrationWarning>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
