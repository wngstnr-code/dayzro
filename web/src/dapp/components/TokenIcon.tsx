import type { Token } from "@/dapp/lib/contracts";

/** Round token badge in the issuer's blue, with the currency sign. */
export function TokenIcon({ symbol, size = 24 }: { symbol: Token["symbol"]; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
            <circle cx="12" cy="12" r="12" fill="#2775CA" />
            <text
                x="12"
                y="16.5"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fontFamily="Public Sans, sans-serif"
                fill="#fff">
                {symbol === "USDC" ? "$" : "€"}
            </text>
        </svg>
    );
}
