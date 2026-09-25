"use client";

import React from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import AboutGrid from "@/widgets/home-screens/components/AboutGrid";
import { HOME_PAG } from "@/widgets/home-screens/lib";
import { TextSplitter } from "@/components/text-splitter";
import Image from "@/components/image";
import { homePageData } from "@/content/pages/home";
import css from "./about.module.scss";

export const About: React.FC = () => {
    const data = homePageData;
    const aboutRef = React.useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            const [strokeEl] = gsap.utils.toArray(
                ".about-grid"
            ) as SVGPathElement[];
            if (strokeEl) {
                gsap.to(strokeEl, {
                    scrollTrigger: {
                        trigger: aboutRef.current,
                        start: "top 75%",
                        once: true,
                        onEnter: () => {
                            const element = aboutRef.current;
                            if (element) {
                                element.classList.add(css._animated);
                            }
                        },
                    },
                    strokeDashoffset: 0,
                    duration: 3,
                });
            }

            gsap.timeline({
                scrollTrigger: {
                    trigger: `.${css.about_title}`,
                    start: "top 95%",
                    end: "bottom 52%",
                    scrub: 0.5,
                },
            }).to(".about-span span", {
                opacity: 1,
                stagger: 0.1,
            });
        },
        { scope: aboutRef }
    );

    return (
        <section className={css.about} ref={aboutRef} id={HOME_PAG.ABOUT}>
            <div className={css.about_wrapper}>
                <div className={css.about_grid}>
                    <AboutGrid />
                    <Image.Default
                        src="/img/home-new/about-grid@mob.svg"
                        alt=""
                    />
                </div>
                <p className={css.about_label}>{data.about_suptitle}</p>
                <h2 className={css.about_title}>
                    <span>
                        <TextSplitter
                            text={data.about_title}
                            className="about-span"
                            tagName="span"
                        />
                    </span>
                </h2>
                <p className={css.about_text}>{data.about_text}</p>
            </div>
        </section>
    );
};
