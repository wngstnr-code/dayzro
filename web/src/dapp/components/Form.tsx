"use client";

import type { ReactNode } from "react";
import { parseUnits } from "viem";
import { cn } from "@/dapp/lib/cn";
import type { Token } from "@/dapp/lib/contracts";
import { busyLabel, type useSendTx } from "@/dapp/lib/tx";

// Small form pieces shared by the Finance and Buyer profile pages.

export function parseTokenAmount(value: string, token: Token): bigint | undefined {
    try {
        return value ? parseUnits(value, token.decimals) : undefined;
    } catch {
        return undefined;
    }
}

export const cleanNumber = (v: string) => v.replace(",", ".").replace(/[^\d.]/g, "");

export function Stat({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rounded-[10px] bg-neutral-background px-[20px] py-[16px] f-col gap-1">
            <span className="text-sm text-tertiary-content">{label}</span>
            <span className="title-subsection-bold text-[20px] leading-tight">{children}</span>
        </div>
    );
}

export function Field({
    label,
    hint,
    suffix,
    value,
    onChange,
    placeholder,
    error,
    right,
}: {
    label: string;
    hint?: ReactNode;
    suffix?: ReactNode;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    error?: string;
    right?: ReactNode;
}) {
    return (
        <div>
            <div className="f-between-center text-sm mb-[8px]">
                <span className="text-tertiary-content">{label}</span>
                {hint && <span className="text-secondary-content">{hint}</span>}
            </div>
            <div className={cn("relative f-row items-center h-[56px] rounded-[10px] bg-neutral-background", error && "shadow-[0_0_0_3px_var(--negative-sentiment)]")}>
                <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-full input-box border-0 bg-transparent font-bold pl-[15px] placeholder:text-tertiary-content placeholder:font-normal"
                />
                {suffix && <span className="pr-[20px] text-secondary-content whitespace-nowrap">{suffix}</span>}
                {right}
            </div>
            <div className="min-h-[20px] mt-[6px] text-sm text-negative-sentiment">{error}</div>
        </div>
    );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
    return (
        <label className="f-row items-start gap-3 cursor-pointer">
            <input type="checkbox" className="toggle toggle-sm mt-[2px]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="text-secondary-content text-sm">{children}</span>
        </label>
    );
}

export function TxStatus({ tx }: { tx: ReturnType<typeof useSendTx> }) {
    const { state, busy } = tx;
    if (busy) return <p className="text-sm text-secondary-content text-center">{busyLabel(state)}</p>;
    if (state.kind === "error") return <p className="text-sm text-negative-sentiment text-center">{state.message}</p>;
    if (state.kind === "done") return <p className="text-sm text-positive-sentiment text-center">{state.label} confirmed.</p>;
    return null;
}
