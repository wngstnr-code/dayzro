"use client";

import { useAppKit, useAppKitState, useAppKitTheme } from "@reown/appkit/react";
import { useEffect } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useConnect } from "wagmi";
import { cn } from "@/dapp/lib/cn";
import { renderNativeBalance, shortenAddress, useIsMobile } from "@/dapp/lib/hooks";
import { useTheme } from "@/dapp/lib/theme";
import { hasAppKit } from "@/dapp/lib/wallet";
import { ActionButton } from "./Buttons";
import { Icon } from "./Icon";

// TODO(branding): replace with an Arc chain icon.
const CHAIN_ICON = "/chains/ethereum.svg";

function Connected({ onClick, className }: { onClick: () => void; className?: string }) {
    const { address, chain } = useAccount();
    const { data: balance } = useBalance({ address });
    const isMobile = useIsMobile();
    const formatted = balance ? formatUnits(balance.value, balance.decimals) : "0";

    return (
        <button
            onClick={onClick}
            className={cn(
                "rounded-full min-w-[140px] flex items-center justify-center md:pl-[8px] md:pr-[3px] md:max-h-[48px] max-h-[40px] min-h-[40px] wc-parent-glass !border-solid gap-2 font-bold",
                className,
            )}>
            <img alt="chain icon" className="w-[24px] ml-[10px]" src={CHAIN_ICON} />
            <span className="flex items-center text-secondary-content justify-self-start gap-4 md:text-normal text-sm">
                {!isMobile && renderNativeBalance(formatted, chain?.nativeCurrency.symbol ?? "USDC", 6)}
                <span className="flex items-center justify-center h-[35px] min-w-[133px] text-center text-tertiary-content btn-glass-bg rounded-full px-[10px] py-[4px] bg-tertiary-background">
                    {shortenAddress(address, 4, 6)}
                </span>
            </span>
        </button>
    );
}

function ConnectCta({ loading, onClick }: { loading: boolean; onClick: () => void }) {
    return (
        <ActionButton
            priority="primary"
            className="!max-w-[215px] !min-h-[32px] !max-h-[48px] !f-items-center !py-0"
            loading={loading}
            onClick={onClick}>
            <div className="flex items-center body-regular space-x-2">
                {loading ? (
                    <span>Connecting</span>
                ) : (
                    <>
                        <Icon type="user-circle" className="md-show-block" fillClass="fill-white" />
                        <span>Connect wallet</span>
                    </>
                )}
            </div>
        </ActionButton>
    );
}

function AppKitConnectButton({ className }: { className?: string }) {
    const { open } = useAppKit();
    const { open: modalOpen } = useAppKitState();
    const { isConnected, address } = useAccount();
    const { setThemeMode } = useAppKitTheme();
    const { theme } = useTheme();

    useEffect(() => setThemeMode(theme), [theme, setThemeMode]);

    if (isConnected && address) return <Connected className={className} onClick={() => open()} />;
    return <ConnectCta loading={modalOpen} onClick={() => !modalOpen && open()} />;
}

function InjectedConnectButton({ className }: { className?: string }) {
    const { isConnected, address } = useAccount();
    const { connect, connectors, isPending } = useConnect();

    if (isConnected && address) return <Connected className={className} onClick={() => {}} />;
    return <ConnectCta loading={isPending} onClick={() => connectors[0] && connect({ connector: connectors[0] })} />;
}

export const ConnectButton = hasAppKit ? AppKitConnectButton : InjectedConnectButton;
