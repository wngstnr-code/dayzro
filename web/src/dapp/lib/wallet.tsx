"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { arc } from "viem/chains";
import { cookieStorage, createConfig, createStorage, http, injected, WagmiProvider, type Config } from "wagmi";
import { readRpcUrl } from "./contracts";

/**
 * WalletConnect / Reown project id (free, from https://cloud.reown.com).
 * Without it we fall back to injected browser wallets only, using the same button UI.
 */
export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
export const hasAppKit = reownProjectId.length > 0;


function buildConfig(): Config {
    if (!hasAppKit) {
        return createConfig({
            chains: [arc],
            connectors: [injected()],
            transports: { [arc.id]: http(readRpcUrl) },
            ssr: true,
            storage: createStorage({ storage: cookieStorage }),
        });
    }

    const adapter = new WagmiAdapter({
        projectId: reownProjectId,
        networks: [arc],
        transports: { [arc.id]: http(readRpcUrl) },
        ssr: true,
        storage: createStorage({ storage: cookieStorage }),
    });

    // Same modal theming as the reference bridge UI.
    createAppKit({
        adapters: [adapter],
        networks: [arc],
        defaultNetwork: arc,
        projectId: reownProjectId,
        metadata: {
            name: "Dayzro",
            description: "Get paid on day zero. Buyer-accepted invoices on Arc.",
            url: typeof window !== "undefined" ? window.location.origin : "https://dayzro.vercel.app",
            icons: [],
        },
        allowUnsupportedChain: true,
        features: { analytics: false, email: false, socials: false, swaps: false, onramp: false },
        themeMode:
            typeof window !== "undefined" && localStorage.getItem("theme") === "light" ? "light" : "dark",
        themeVariables: {
            "--w3m-color-mix": "var(--neutral-background)",
            "--w3m-color-mix-strength": 20,
            "--w3m-font-family": '"Public Sans", sans-serif',
            "--w3m-border-radius-master": "9999px",
            "--w3m-accent": "var(--primary-brand)",
        },
    });

    return adapter.wagmiConfig;
}

export const wagmiConfig = buildConfig();

export function WalletProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    );
}
