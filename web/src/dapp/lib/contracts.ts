import { type Address, BaseError, ContractFunctionRevertedError, getAddress, isAddress, zeroAddress } from "viem";
import { arc } from "viem/chains";

function envAddress(value: string | undefined): Address | undefined {
    return value && isAddress(value) ? getAddress(value) : undefined;
}

/** Deployed Dayzro contracts, from NEXT_PUBLIC_* in the root .env (or web/.env.local on the local fork). */
export const contracts = {
    registry: envAddress(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS),
    facility: envAddress(process.env.NEXT_PUBLIC_FACILITY_ADDRESS),
};

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || arc.rpcUrls.default.http[0];

/** True when the app runs against a local node (scripts/fork.sh), where explorer links would be dead. */
export const isLocalChain = /\/\/(127\.0\.0\.1|localhost)[:/]/.test(rpcUrl);

export function explorerTx(hash: string): string | undefined {
    return isLocalChain ? undefined : `${arc.blockExplorers.default.url}/tx/${hash}`;
}

export type Token = { symbol: "USDC" | "EURC"; name: string; address: Address; decimals: number };

// The two ERC-20s the Registry allows. Both use 6 decimals. Never use Arc's native 18-decimal balance.
export const tokens: Token[] = [
    { symbol: "USDC", name: "USD Coin", address: "0x3600000000000000000000000000000000000000", decimals: 6 },
    { symbol: "EURC", name: "Euro Coin", address: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1", decimals: 6 },
];

/** Registry limits, mirrored from DayzroRegistry (MIN_FACE, MAX_TENOR). */
export const MIN_FACE = BigInt(1_000_000);
export const MAX_TENOR_DAYS = 365;

export const ZERO_HASH = `0x${"0".repeat(64)}` as const;
export { zeroAddress };

const revertMessages: Record<string, string> = {
    TokenNotAllowed: "This token is not accepted by the registry.",
    InvalidParty: "The buyer must be a different address from yours.",
    InvalidAmount: "The amount must be at least 1.",
    InvalidDueDate: "The due date must be in the future and within 365 days.",
    NotBuyer: "Only the buyer can do this.",
    NotSupplier: "Only the supplier can do this.",
    NotHolder: "Only the current holder can do this.",
    WrongStatus: "This receivable is not in the right state for that action.",
};

/** Turns a viem error into one readable sentence (wallet rejection, known contract revert, or the short message). */
export function readableError(error: unknown): string {
    if (error instanceof BaseError) {
        const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError) {
            const name = revert.data?.errorName;
            if (name && revertMessages[name]) return revertMessages[name];
            if (name) return `The contract rejected this (${name}).`;
        }
        if (error.walk((e) => (e as { code?: number }).code === 4001)) return "You rejected the request in your wallet.";
        return error.shortMessage;
    }
    return error instanceof Error ? error.message : "Something went wrong.";
}
