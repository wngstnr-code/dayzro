"use client";

import React, { SVGProps } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";

/* Line drawing of a USDC coin: the invoice's other face once it is financed. */
const UsdcOutline: React.FC<SVGProps<SVGSVGElement>> = (props) => {
    // Same orbiting ember highlight as the Dayzro outline.
    useGSAP(() => {
        gsap.to(".dz-usdc-gradient", {
            attr: { gradientTransform: "rotate(-360 24 24)" },
            repeat: -1,
            duration: 4,
            ease: "none",
        });
    });

    return (
        <svg {...props} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke="url(#dz-usdc-gradient)" strokeWidth="0.55" strokeLinecap="round">
                <circle cx="24" cy="24" r="22" />
                <path d="M17.5 9.5A15.5 15.5 0 0 0 17.5 38.5M30.5 9.5A15.5 15.5 0 0 1 30.5 38.5" />
                <path d="M24 12.5V35.5" />
                <path d="M28.6 19.2C28.2 17.3 26.4 16.2 24 16.2C21.2 16.2 19.3 17.6 19.3 19.8C19.3 22.3 21.6 23.1 24 23.7C26.6 24.3 28.9 25.1 28.9 27.9C28.9 30.3 26.8 31.8 24 31.8C21.2 31.8 19.2 30.5 18.9 28.4" />
            </g>
            <defs>
                <linearGradient
                    id="dz-usdc-gradient"
                    className="dz-usdc-gradient"
                    gradientTransform="rotate(0 24 24)"
                    x1="24"
                    y1="13"
                    x2="-3"
                    y2="60"
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

export default UsdcOutline;
