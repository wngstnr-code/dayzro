"use client";

import { gsap } from "@/lib/gsap";

export function markSwapAnimation() {
    const getRounds = (r: number) => r * 360;
    const duration = 0.5;

    let active = false;

    const tl = gsap
        .timeline({
            onComplete() {
                if (active) {
                    tl.restart();
                }
            },
            paused: true,
        })
        .to(
            "#steps-mark-dayzro",
            {
                ease: "power4.in",
                rotate: getRounds(3),
                opacity: 0,
                duration,
                onComplete() {
                    gsap.set("#steps-mark-dayzro", { rotate: 0 });
                },
            },
            "swapIn"
        )
        .to(
            "#steps-mark-usdc",
            {
                ease: "power4.out",
                rotate: getRounds(3),
                opacity: 1,
                duration,
                onComplete() {
                    gsap.set("#steps-mark-usdc", { rotate: 0 });
                },
            },
            `swapIn+=${duration * 0.8}`
        )
        .to("body", {
            duration: 2,
        })
        .to(
            "#steps-mark-usdc",
            {
                ease: "power4.in",
                rotate: getRounds(3),
                opacity: 0,
                duration,
                onComplete() {
                    gsap.set("#steps-mark-usdc", { rotate: 0 });
                },
            },
            `swapOut`
        )
        .to(
            "#steps-mark-dayzro",
            {
                ease: "power4.out",
                rotate: getRounds(3),
                opacity: 1,
                duration,
                onComplete() {
                    gsap.set("#steps-mark-dayzro", { rotate: 0 });
                },
            },
            `swapOut+=${duration * 0.8}`
        )
        .to("body", {
            duration: 2,
        });

    // Hold on the Dayzro mark for a beat before the first swap, so it is seen in full.
    const HOLD = 0.5;
    let pending: gsap.core.Tween | null = null;

    const play = () => {
        if (!active) {
            active = true;
            pending?.kill();
            pending = gsap.delayedCall(HOLD, () => {
                pending = null;
                if (!active) return;
                tl.timeScale(1);
                tl.restart();
            });
        }
    };

    const finish = () => {
        if (active) {
            active = false;
            pending?.kill();
            pending = null;
            tl.timeScale(4);
        }
    };

    return { play, finish };
}
