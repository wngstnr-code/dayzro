import React, { useId } from "react";
import { brand } from "./tokens";

type Props = {
    size?: number;
    className?: string;
    /** Render the whole mark in one flat color (e.g. white on the gradient app icon). */
    mono?: string;
};

/**
 * Dayzro mark: a rounded "0" split by the horizon. Above it the sun rises (half disc,
 * three rays, soft glow clipped to the sky): day zero. Gradient runs sunrise to magenta.
 */
export const DayzroMark: React.FC<Props> = ({ size = 28, className, mono }) => {
    const id = useId().replace(/:/g, "");
    const stroke = mono ?? `url(#dz-g-${id})`;

    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <linearGradient id={`dz-g-${id}`} x1="24" y1="3" x2="24" y2="45" gradientUnits="userSpaceOnUse">
                    <stop stopColor={brand.sunrise} />
                    <stop offset="1" stopColor={brand.magenta} />
                </linearGradient>
                <radialGradient id={`dz-w-${id}`} cx="24" cy="29" r="15" gradientUnits="userSpaceOnUse">
                    <stop stopColor={mono ?? brand.sunrise} stopOpacity={0.55} />
                    <stop offset="1" stopColor={mono ?? brand.sunrise} stopOpacity={0} />
                </radialGradient>
                <clipPath id={`dz-c-${id}`}>
                    <rect x="10.5" y="6" width="27" height="23" />
                </clipPath>
            </defs>
            <circle cx="24" cy="29" r="15" fill={`url(#dz-w-${id})`} clipPath={`url(#dz-c-${id})`} />
            <rect x="8" y="3.5" width="32" height="41" rx="16" stroke={stroke} strokeWidth="5" />
            <path d="M16.5 29a7.5 7.5 0 0 1 15 0z" fill={stroke} />
            <path
                d="M24 15.5v3.4M15.2 19.4l2.4 2.4M32.8 19.4l-2.4 2.4"
                stroke={stroke}
                strokeWidth="2.6"
                strokeLinecap="round"
            />
            <path d="M10.5 29h27" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
        </svg>
    );
};
