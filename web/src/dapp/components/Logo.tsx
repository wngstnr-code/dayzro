"use client";

import { DayzroMark } from "@/brand/dayzro-mark";
import { cn } from "@/dapp/lib/cn";

/** Dayzro lockup for the app header, sized like the bridge UI's logo (77px mobile, 125px desktop). */
export function LogoWithText({ className }: { className?: string }) {
    return (
        <a href="/" className={cn("inline-flex items-center gap-2", className)} aria-label="Dayzro home">
            <DayzroMark size={30} className="w-[24px] h-[24px] md:w-[30px] md:h-[30px] shrink-0" />
            <span className="font-['Clash_Grotesk'] font-semibold text-[18px] md:text-[23px] leading-none tracking-[-0.02em] text-[color:var(--primary-content)]">
                Dayzro
            </span>
        </a>
    );
}
