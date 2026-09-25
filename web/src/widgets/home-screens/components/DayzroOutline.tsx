"use client";

import React, { SVGProps } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";

/*
 * Outline version of the Dayzro mark (same 48x48 geometry as src/brand/dayzro-mark.tsx).
 * A light grey line drawing with an ember highlight that orbits the shape, where the
 * 3D hero logo lands on scroll.
 */
const Shape: React.FC<{ stroke: string }> = ({ stroke }) => (
    <g stroke={stroke} strokeWidth="0.45" fill="none" strokeLinejoin="round">
        {/* ring */}
        <rect x="5.5" y="1" width="37" height="46" rx="18.5" />
        <rect x="10.5" y="6" width="27" height="36" rx="13.5" />
        {/* horizon with the half sun rising out of it */}
        <path d="M10.5 27.4H16.67A7.5 7.5 0 0 1 31.33 27.4H37.5M10.5 30.6H37.5" />
        {/* rays */}
        <rect x="22.7" y="14.2" width="2.6" height="6" rx="1.3" />
        <rect x="13.4" y="19.3" width="6" height="2.6" rx="1.3" transform="rotate(45 16.4 20.6)" />
        <rect x="28.6" y="19.3" width="6" height="2.6" rx="1.3" transform="rotate(-45 31.6 20.6)" />
    </g>
);

const DayzroOutline: React.FC<SVGProps<SVGSVGElement>> = (props) => {
    useGSAP(() => {
        gsap.to(".dz-outline-gradient", {
            attr: { gradientTransform: "rotate(-360 24 24)" },
            repeat: -1,
            duration: 4,
            ease: "none",
        });
    });

    return (
        <svg {...props} viewBox="4.5 0 39 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Shape stroke="#E6E6E6" />
            <Shape stroke="url(#dz-outline-gradient)" />
            <defs>
                <linearGradient
                    id="dz-outline-gradient"
                    className="dz-outline-gradient"
                    gradientTransform="rotate(0 24 24)"
                    x1="43"
                    y1="14"
                    x2="24"
                    y2="68"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#E6E6E6" />
                    <stop offset="0.22" stopColor="#C2410C" />
                    <stop offset="0.42" stopColor="#E6E6E6" />
                    <stop offset="1" stopColor="#E6E6E6" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export default DayzroOutline;
