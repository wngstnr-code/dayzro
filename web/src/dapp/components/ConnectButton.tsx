"use client";

import { useAppKit, useAppKitState, useAppKitTheme } from "@reown/appkit/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { arc } from "viem/chains";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { cn } from "@/dapp/lib/cn";
import { formatAmount } from "@/dapp/lib/format";
import { shortenAddress, useIsMobile } from "@/dapp/lib/hooks";
import { useTheme } from "@/dapp/lib/theme";
import { contracts, isLocalChain, rpcUrl } from "@/dapp/lib/contracts";
import { hasAppKit } from "@/dapp/lib/wallet";
import { Icon } from "./Icon";

// Arc's own mark (from arc.io), on its navy.
const CHAIN_ICON = "/chains/arc.svg";

function Connected({ onClick, className }: { onClick: () => void; className?: string }) {
    const { address, chain } = useAccount();
    // Always Arc, whatever network the wallet is on; unknown is shown as "…", never as a fake 0.
    const { data: balance } = useBalance({ address, chainId: arc.id });
    const isMobile = useIsMobile();
    const formatted = balance ? formatAmount(balance.value, balance.decimals) : "…";

    return (
        <button
            onClick={onClick}
            className={cn(
                "rounded-full min-w-[140px] flex items-center justify-center md:pl-[8px] md:pr-[3px] md:max-h-[48px] max-h-[40px] min-h-[40px] wc-parent-glass !border-solid gap-2 font-bold",
                className,
            )}>
            <img alt="chain icon" className="w-[24px] ml-[10px]" src={CHAIN_ICON} />
            <span className="flex items-center text-secondary-content justify-self-start gap-4 md:text-normal text-sm">
                {!isMobile && `${formatted} ${chain?.nativeCurrency.symbol ?? "USDC"}`}
                <span className="flex items-center justify-center h-[35px] min-w-[133px] text-center text-tertiary-content btn-glass-bg rounded-full px-[10px] py-[4px] bg-tertiary-background">
                    {shortenAddress(address, 4, 6)}
                </span>
            </span>
        </button>
    );
}

// Same size and type as the header tabs (Supplier / Financier) next to it.
function ConnectCta({ loading, onClick }: { loading: boolean; onClick: () => void }) {
    return (
        <button
            className="btn btn-primary text-white border-none h-[40px] px-[28px] rounded-full"
            onClick={onClick}>
            {loading && <span className="loading loading-spinner w-4 h-4" />}
            <span>{loading ? "Connecting" : "Connect wallet"}</span>
        </button>
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

/** Account menu for the injected fallback (AppKit opens its own modal instead). */
/**
 * On the local fork the wallet can report chain 5042 while still sending to Arc mainnet's RPC
 * (same chain id, different node). Ask the wallet's own node whether the registry exists there.
 */
function useWalletOnFork() {
    const { connector, chainId } = useAccount();
    const [onFork, setOnFork] = useState<boolean>();
    const [adding, setAdding] = useState(false);

    const provider = useCallback(
        async () => (await connector?.getProvider()) as EIP1193Provider | undefined,
        [connector],
    );

    const check = useCallback(async () => {
        const p = await provider();
        if (!isLocalChain || !p || !contracts.registry) return;
        const code = await p.request({ method: "eth_getCode", params: [contracts.registry, "latest"] }).catch(() => "0x");
        setOnFork(!!code && code !== "0x");
    }, [provider]);

    useEffect(() => {
        check();
    }, [check, chainId]);

    // Offers the fork as a network. Wallets that already know chain 5042 may keep their own RPC, hence the manual hint.
    const addFork = async () => {
        const p = await provider();
        if (!p) return;
        setAdding(true);
        await p
            .request({
                method: "wallet_addEthereumChain",
                params: [
                    {
                        chainId: `0x${arc.id.toString(16)}`,
                        chainName: "Arc (local fork)",
                        rpcUrls: [rpcUrl],
                        nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
                    },
                ],
            })
            .catch(() => {});
        setAdding(false);
        check();
    };

    return { onFork, adding, addFork };
}

function AccountMenu({ onClose }: { onClose: () => void }) {
    const { address, chainId } = useAccount();
    const { disconnect } = useDisconnect();
    const { switchChain, isPending: switching } = useSwitchChain();
    const [copied, setCopied] = useState(false);
    const wrongChain = chainId !== arc.id;
    const fork = useWalletOnFork();
    const item = "w-full f-row items-center gap-3 px-3 py-[10px] rounded-[10px] hover:bg-primary-interactive-hover text-left";

    return (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[260px] rounded-[20px] border border-divider-border bg-[color:var(--dialog-background)] p-2 shadow-xl z-50">
            <div className="px-3 pt-2 pb-3">
                <p className="text-xs text-tertiary-content">Connected</p>
                <p className="body-bold">{shortenAddress(address, 6, 4)}</p>
            </div>
            {/* One row, as before: wrong chain switches chain; right chain but the wrong node (local fork) adds the fork. */}
            {(wrongChain || fork.onFork === false) && (
                <button
                    className={item}
                    disabled={switching || fork.adding}
                    title={wrongChain ? undefined : `Uses RPC ${rpcUrl}`}
                    onClick={() => (wrongChain ? switchChain({ chainId: arc.id }) : fork.addFork())}>
                    <Icon type="exclamation-circle" fillClass="fill-warning-sentiment" />
                    <span className="text-warning-sentiment">
                        {switching || fork.adding ? "Check your wallet" : "Switch to Arc"}
                    </span>
                </button>
            )}
            <button
                className={item}
                onClick={() => {
                    if (address) navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}>
                <Icon type={copied ? "check" : "cards"} />
                <span>{copied ? "Copied" : "Copy address"}</span>
            </button>
            {!isLocalChain && (
                <a
                    className={item}
                    href={`${arc.blockExplorers.default.url}/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}>
                    <Icon type="explorer" />
                    <span>View on explorer</span>
                </a>
            )}
            <div className="h-sep my-1" />
            <button
                className={item}
                onClick={() => {
                    disconnect();
                    onClose();
                }}>
                <Icon type="x-close-circle" />
                <span>Disconnect</span>
            </button>
        </div>
    );
}

/**
 * Wallet picker for the injected fallback. Every extension that announces itself over EIP-6963
 * (OKX, Rabby, MetaMask, ...) gets its own row, so the user connects the wallet they clicked
 * rather than whichever extension grabbed window.ethereum.
 */
function WalletPicker({ onDone }: { onDone: () => void }) {
    const { connectors, connectAsync } = useConnect();
    const [pendingId, setPendingId] = useState<string>();
    const [error, setError] = useState<string>();

    const announced = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
    const generic = connectors.find((c) => c.id === "injected");
    const hasWindowWallet = typeof window !== "undefined" && "ethereum" in window;
    const list = announced.length > 0 ? announced : hasWindowWallet && generic ? [generic] : [];
    const item = "w-full f-row items-center gap-3 px-3 py-[10px] rounded-[10px] hover:bg-primary-interactive-hover text-left";

    return (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[260px] rounded-[20px] border border-divider-border bg-[color:var(--dialog-background)] p-2 shadow-xl z-50">
            <p className="px-3 pt-2 pb-2 text-xs text-tertiary-content">Choose a wallet</p>
            {list.map((c) => (
                <button
                    key={c.uid}
                    className={item}
                    disabled={!!pendingId}
                    onClick={async () => {
                        setPendingId(c.uid);
                        setError(undefined);
                        try {
                            await connectAsync({ connector: c });
                            onDone();
                        } catch (e) {
                            setError((e as Error).message.split("\n")[0]);
                        } finally {
                            setPendingId(undefined);
                        }
                    }}>
                    {c.icon ? (
                        <img src={c.icon} alt="" className="w-[28px] h-[28px] rounded-[8px]" />
                    ) : (
                        <Icon type="user-circle" size={28} />
                    )}
                    <span className="flex-1">{c.id === "injected" ? "Browser wallet" : c.name}</span>
                    {pendingId === c.uid && <span className="loading loading-spinner w-4 h-4" />}
                </button>
            ))}
            {list.length === 0 && (
                <a className={item} href="https://www.okx.com/web3" target="_blank" rel="noreferrer">
                    <Icon type="arrow-top-right" />
                    <span>No wallet found. Install one</span>
                </a>
            )}
            {error && <p className="px-3 py-2 text-xs text-negative-sentiment">{error}</p>}
        </div>
    );
}

function InjectedConnectButton({ className }: { className?: string }) {
    const { isConnected, address } = useAccount();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", esc);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", esc);
        };
    }, [open]);

    const connected = isConnected && !!address;
    return (
        <div ref={ref} className="relative">
            {connected ? (
                <Connected className={className} onClick={() => setOpen((o) => !o)} />
            ) : (
                <ConnectCta loading={false} onClick={() => setOpen((o) => !o)} />
            )}
            {open && (connected ? <AccountMenu onClose={() => setOpen(false)} /> : <WalletPicker onDone={() => setOpen(false)} />)}
        </div>
    );
}

export const ConnectButton = hasAppKit ? AppKitConnectButton : InjectedConnectButton;
