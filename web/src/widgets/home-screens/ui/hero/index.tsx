"use client";

import React from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { homePageData } from "@/content/pages/home";
import { HOME_PAG } from "@/widgets/home-screens/lib";
import { DayzroLogo3D } from "@/widgets/home-screens/components/DayzroLogo3D";
import css from "./hero.module.scss";

export const Hero: React.FC = () => {
    const data = homePageData;

    useGSAP(() => {
        const heroMark = document.getElementById("hero-mark");
        const stepsMark = document.getElementById("steps-mark");

        // Align centers (not tops): the hero box is square, the outline box is taller than wide.
        const centerOf = (el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            return r.top + r.height / 2;
        };

        if (heroMark && stepsMark) {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: heroMark,
                    // clamp(): on short viewports the logo already sits above 30% at load, which
                    // would start the hand-off early and push the logo out of its frame.
                    start: "clamp(top 30%)",
                    end: "top 30%",
                    endTrigger: stepsMark,
                    scrub: 1.2,
                    invalidateOnRefresh: true,
                },
            });

            tl.to(
                "#hero-mark > *",
                {
                    y: () => centerOf(stepsMark) - centerOf(heroMark),
                },
                0
            );

            tl.fromTo(
                "#steps-mark-mover",
                {
                    y: () => centerOf(heroMark) - centerOf(stepsMark),
                },
                {
                    y: 0,
                },
                0
            );
        }
    });

    return (
        <section className={css.hero} id={HOME_PAG.HERO}>
            <div className="container">
                <div className={css.hero_wrapper}>
                    <h1 className={css.hero_title}>{data.hero_title}</h1>
                    <div className={css.hero_mark}>
                        <div className={css.hero_mark_inner}>
                            <div className={css.hero_mark_img} id="hero-mark">
                                <DayzroLogo3D />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
