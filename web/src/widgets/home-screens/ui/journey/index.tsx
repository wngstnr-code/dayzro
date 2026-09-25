"use client";

import React from "react";
import { JourneyItem } from "../journey-item";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import JourneyPath from "@/widgets/home-screens/components/JourneyPath";
import { HOME_PAG } from "@/widgets/home-screens/lib";
import { homePageData } from "@/content/pages/home";
import css from "./journey.module.scss";

// Card positions along the path (the design has six). The three audience cards take the
// start, the middle and the end of the path so it reads evenly.
const positions = [
    {
        className: css.journey_24q2,
        progress: 0.01,
        variant: "magenta",
    },
    {
        className: css.journey_24q3,
        progress: 0.12,
        variant: "sunrise",
    },
    {
        className: css.journey_24q4,
        progress: 0.24,
        variant: "gold",
    },
    {
        className: css.journey_25q1,
        progress: 0.4,
        variant: "magenta",
    },
    {
        className: css.journey_25q2,
        progress: 0.6,
        variant: "sunrise",
    },
    {
        className: css.journey_25h1,
        progress: 0.92,
        variant: "gold",
    },
] as const;

// Suppliers (sunrise) at the start, buyers (magenta) on the path halfway down, financiers (gold) at the end.
const cards = [
    { ...positions[0], variant: "sunrise" },
    { className: css.journey_path_mid, progress: 0.45, variant: "magenta" },
    { ...positions[5], variant: "gold" },
] as const;

export const Journey: React.FC = () => {
    const data = homePageData;
    const journeyRef = React.useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            const [path] = gsap.utils.toArray(
                ".journey-path"
            ) as SVGPathElement[];
            const quarters = gsap.utils.toArray(
                ".journey-item-content"
            ) as HTMLElement[];

            if (path) {
                gsap.to(path, {
                    scrollTrigger: {
                        trigger: "#journey-path-area",
                        start: "top 50%",
                        end: "bottom 90%",
                        invalidateOnRefresh: true,
                        scrub: 3,
                    },
                    onUpdate() {
                        quarters.forEach((el) => {
                            const targetProgress = +(
                                el.dataset.progress || "0"
                            );
                            el.style.height = `${targetProgress < this.progress() ? el.scrollHeight : 0}px`;
                        });
                    },
                    strokeDashoffset: 0,
                });
            }
        },
        { scope: journeyRef }
    );

    return (
        <section className={css.journey} ref={journeyRef} id={HOME_PAG.JOURNEY}>
            <div className={css.journey_content}>
                <p className={css.journey_label}>
                    {data.audience_suptitle}
                </p>
                <h2 className={css.journey_title}>
                    {data.audience_title}
                </h2>
                <div className={css.journey_path} id="journey-path-area">
                    <JourneyPath />
                    {data.audience_list.map((item, index) => {
                        const card = cards[index];
                        if (!card) return null;
                        return (
                            <JourneyItem
                                className={card.className}
                                progress={card.progress}
                                variant={card.variant}
                                title={item.title}
                                content={item.points}
                                uniform
                                key={item.id}
                            />
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
