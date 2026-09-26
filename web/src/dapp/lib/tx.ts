"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Abi, type Address, createPublicClient, custom, type TransactionReceipt } from "viem";
import { arc } from "viem/chains";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { contracts, isLocalChain, readableError } from "./contracts";

export type Call = {
    /** Shown on the button while this call waits for the wallet, e.g. "Approve USDC". */
    label: string;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
};

export type TxState =
    | { kind: "idle" }
    | { kind: "signing"; label: string; step: number; steps: number }
    | { kind: "mining"; label: string; step: number; steps: number; hash: `0x${string}` }
    | { kind: "done"; label: string; hash: `0x${string}`; receipt: TransactionReceipt }
    | { kind: "error"; message: string };

/**
 * Sends one or more contract calls in order (e.g. approve, then pay), each simulated first so
 * reverts show as sentences before the wallet opens. Returns the last receipt, or undefined on failure.
 */
export function useSendTx() {
    const { address, chainId } = useAccount();
    const publicClient = usePublicClient({ chainId: arc.id });
    const { data: walletClient } = useWalletClient();
    const [state, setState] = useState<TxState>({ kind: "idle" });
    const queryClient = useQueryClient();

    const send = async (calls: Call[]): Promise<TransactionReceipt | undefined> => {
        if (!publicClient || !walletClient || !address || calls.length === 0) return;
        try {
            setState({ kind: "signing", label: calls[0].label, step: 1, steps: calls.length });
            if (chainId !== arc.id) await walletClient.switchChain({ id: arc.id });

            // The wallet may report chain 5042 while using another node (Arc mainnet vs the local fork).
            if (contracts.registry) {
                const walletNode = createPublicClient({ chain: arc, transport: custom({ request: walletClient.request }) });
                const code = await walletNode.getCode({ address: contracts.registry });
                if (!code || code === "0x") {
                    setState({
                        kind: "error",
                        message: isLocalChain
                            ? "Your wallet is not on the local fork. Add a network with RPC http://127.0.0.1:8545 and chain id 5042."
                            : "Your wallet's network does not have the Dayzro registry.",
                    });
                    return;
                }
            }

            let receipt: TransactionReceipt | undefined;
            for (const [i, call] of calls.entries()) {
                const progress = { label: call.label, step: i + 1, steps: calls.length };
                setState({ kind: "signing", ...progress });
                const { request } = await publicClient.simulateContract({
                    account: address,
                    address: call.address,
                    abi: call.abi,
                    functionName: call.functionName,
                    args: call.args,
                } as never);
                const hash = await walletClient.writeContract(request as never);
                setState({ kind: "mining", ...progress, hash });
                receipt = await publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status !== "success") {
                    setState({ kind: "error", message: `${call.label} reverted.` });
                    return;
                }
            }
            // Balances and reads anywhere on the page are stale now.
            queryClient.invalidateQueries();
            setState({ kind: "done", label: calls[calls.length - 1].label, hash: receipt!.transactionHash, receipt: receipt! });
            return receipt;
        } catch (error) {
            setState({ kind: "error", message: readableError(error) });
        }
    };

    const busy = state.kind === "signing" || state.kind === "mining";
    return { send, state, busy, reset: () => setState({ kind: "idle" }) };
}

/** Button text for a running multi-step send: "Approve USDC (1 of 2)", then "Paying...". */
export function busyLabel(state: TxState): string | undefined {
    if (state.kind !== "signing" && state.kind !== "mining") return;
    const count = state.steps > 1 ? ` (${state.step} of ${state.steps})` : "";
    return state.kind === "signing" ? `${state.label}${count}: confirm in wallet` : `${state.label}${count}...`;
}
