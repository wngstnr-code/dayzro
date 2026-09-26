// Mirrors DayzroRegistry.Status and its flags.
export const Status = { None: 0, Pending: 1, Accepted: 2, Paid: 3, Cancelled: 4, Defaulted: 5 } as const;
export const FLAG_GUARANTEED = 1;

export type Tone = "warning" | "positive" | "negative" | "neutral";

export function statusOf(status: number, overdue: boolean): { label: string; tone: Tone } {
    switch (status) {
        case Status.Pending:
            return { label: "Waiting for buyer", tone: "warning" };
        case Status.Accepted:
            return overdue ? { label: "Overdue", tone: "negative" } : { label: "Accepted", tone: "positive" };
        case Status.Paid:
            return { label: "Paid", tone: "positive" };
        case Status.Cancelled:
            return { label: "Cancelled", tone: "neutral" };
        default:
            return { label: "Defaulted", tone: "negative" };
    }
}

export const toneClass: Record<Tone, string> = {
    warning: "bg-warning-background text-warning-sentiment",
    positive: "bg-positive-background text-positive-sentiment",
    negative: "bg-negative-background text-negative-sentiment",
    neutral: "bg-neutral-background text-secondary-content",
};
