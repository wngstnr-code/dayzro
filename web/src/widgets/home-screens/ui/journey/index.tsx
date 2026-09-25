"use client";

import React from "react";
import { JourneyItem } from "../journey-item";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import JourneyPath from "@/widgets/home-screens/components/JourneyPath";
import { HOME_PAG } from "@/widgets/home-screens/lib";
import { homePageData } from "@/content/pages/home";
import css from "./journey.module.scss";

const external = [
    {
        className: css.journey_24q2,
        progress: 0.01,
        variant: undefined,
    },
    {
        className: css.journey_24q3,
        progress: 0.12,
        variant: "pink",
    },
    {
        className: css.journey_24q4,
        progress: 0.24,
        variant: "orange",
    },
    {
        className: css.journey_25q1,
        progress: 0.4,
        variant: "blue",
    },
    {
        className: css.journey_25q2,
        progress: 0.6,
        variant: "pink",
    },
    {
        className: css.journey_25h1,
        progress: 0.92,
        variant: "orange",
    },
];

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
                        trigger: "#journey-roadmap",
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
                    {data.roadmap_suptitle}
                </p>
                <h2 className={css.journey_title}>
                    {data.roadmap_title}
                </h2>
                <div className={css.journey_roadmap} id="journey-roadmap">
                    <JourneyPath />
                    {data.roadmap_list.map((item, index) => {
                        const ext = external[index];
                        if (!ext) return null;
                        return (
                            <JourneyItem
                                className={ext.className}
                                progress={ext.progress}
                                variant={ext.variant as "blue" | "pink" | "orange" | undefined}
                                title={item.title}
                                content={item.data.map((p) => p.text)}
                                key={item.id}
                            />
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
