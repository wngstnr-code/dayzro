"use client";

import { useEffect, useState } from "react";

/** Mirrors the bridge UI's DesktopOrLarger component (min-width: 768px). */
export function useIsDesktopOrLarger(): boolean {
    const [is, setIs] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(min-width: 768px)");
        setIs(query.matches);
        const onChange = (event: MediaQueryListEvent) => setIs(event.matches);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return is;
}

export function useIsMobile(): boolean {
    const [is, setIs] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(max-width: 767px)");
        setIs(query.matches);
        const onChange = (event: MediaQueryListEvent) => setIs(event.matches);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return is;
}

/** Same output as the bridge UI's shortenAddress(address, charsStart, charsEnd). */
export function shortenAddress(address: string | undefined, charsStart = 6, charsEnd = 4, sep = "…"): string {
    if (!address) return "0x";
    return [address.slice(0, charsStart), address.slice(-charsEnd)].join(sep);
}
