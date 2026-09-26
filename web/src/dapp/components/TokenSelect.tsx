"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/dapp/lib/cn";
import { type Token, tokens } from "@/dapp/lib/contracts";
import { Icon } from "./Icon";
import { TokenIcon } from "./TokenIcon";

/** USDC / EURC picker that sits at the right end of an amount field (where the bridge had its token picker). */
export function TokenSelect({ value, onChange }: { value: Token; onChange: (t: Token) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    return (
        <div ref={ref} className="relative h-full min-w-[151px] z-30">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="f-between-center w-full h-full px-[20px] py-[14px] input-box bg-neutral-background border-0 shadow-none outline-none !rounded-l-[0px] !rounded-r-[10px]">
                <div className="f-row items-center gap-2">
                    <TokenIcon symbol={value.symbol} />
                    <span className="title-subsection-bold text-base">{value.symbol}</span>
                </div>
                <Icon type="chevron-down" size={10} />
            </button>
            {open && (
                <ul className="absolute right-0 mt-2 w-[200px] rounded-[10px] bg-neutral-background border border-primary-border-dark p-2 shadow-lg">
                    {tokens.map((t) => (
                        <li key={t.symbol}>
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(t);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "w-full f-row items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-primary-interactive-hover",
                                    t.symbol === value.symbol && "bg-primary-interactive-hover",
                                )}>
                                <TokenIcon symbol={t.symbol} />
                                <span className="flex flex-col items-start">
                                    <span className="body-bold">{t.symbol}</span>
                                    <span className="text-xs text-tertiary-content">{t.name}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
