"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/dapp/components/Shell";
import { ThemeProvider } from "@/dapp/lib/theme";
import { WalletProvider } from "@/dapp/lib/wallet";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <WalletProvider>
                <AppShell>{children}</AppShell>
            </WalletProvider>
        </ThemeProvider>
    );
}
