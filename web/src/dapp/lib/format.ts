import { formatUnits } from "viem";

/** 1500000000n with 6 decimals -> "1,500" (up to 2 decimals, more only when needed below 1). */
export function formatAmount(value: bigint, decimals = 6): string {
    const n = Number(formatUnits(value, decimals));
    return n.toLocaleString(undefined, { maximumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 6 : 2 });
}

export function formatDate(unixSeconds: bigint | number): string {
    return new Date(Number(unixSeconds) * 1000).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/** Calendar days from today until the day of `unixSeconds` (negative when past), matching the due date picker. */
export function daysUntil(unixSeconds: bigint | number): number {
    const due = new Date(Number(unixSeconds) * 1000);
    const today = new Date();
    const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((utc(due) - utc(today)) / 86_400_000);
}

export function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}
