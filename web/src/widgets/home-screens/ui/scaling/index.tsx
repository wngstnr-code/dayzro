"use client";

import React from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { markSwapAnimation } from "@/widgets/home-screens/lib/mark-swap-animation";
import UsdcOutline from "@/widgets/home-screens/components/UsdcOutline";
import Rays from "@/widgets/home-screens/components/Rays";
import DayzroOutline from "@/widgets/home-screens/components/DayzroOutline";
import { HOME_PAG } from "@/widgets/home-screens/lib";
import { SequentialDots } from "@/animations/SequentialDots";
import Image from "@/components/image";
import { homePageData } from "@/content/pages/home";
import css from "./scaling.module.scss";

export const Scaling: React.FC = () => {
    const data = homePageData;
    const scalingRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    useGSAP(
        () => {
            const element = scalingRef.current;
            if (element) {
                const lines = gsap.utils.toArray(
                    ".scaling-line"
                ) as SVGPathElement[];

                const setStrokeLength = (percent: number) => {
                    lines.forEach((line) => {
                        const length = line.getTotalLength();
                        const lineLength =
                            (window.innerHeight + window.innerWidth) * 0.4;
                        gsap.set(line, {
                            strokeDasharray: `${lineLength} ${length - lineLength}`,
                            strokeDashoffset:
                                lineLength +
                                length -
                                (lineLength + length) * percent,
                        });
                    });
                };

                setStrokeLength(0);

                gsap.to(element, {
                    scrollTrigger: {
                        trigger: element,
                        start: "top top",
                        end: "top+=300% top",
                        pin: true,
                        scrub: 1,
                        invalidateOnRefresh: true,
                    },
                    ease: "none",
                    x: () => {
                        const width = element.scrollWidth - window.innerWidth;
                        return -width;
                    },
                });

                gsap.to(element, {
                    scrollTrigger: {
                        trigger: element,
                        start: "top top",
                        end: "top+=330% top",
                        scrub: 1.5,
                        invalidateOnRefresh: true,
                    },
                    ease: "none",
                    onUpdate() {
                        const progress = this.progress();
                        setStrokeLength(progress);
                    },
                });

                const logoAnimation = markSwapAnimation();

                // Start the Dayzro/USDC swap as soon as the outline mark is fully on screen. The mark
                // is carried in by the scrubbed hero hand-off, so its real position is checked every
                // frame rather than from a fixed scroll offset. Scrolling back up (mark drops below
                // the fold again) winds the swap back to the Dayzro mark.
                // The section clips its content (overflow: hidden), so "on screen" means inside both
                // the viewport and the section.
                const mark = document.getElementById("steps-mark-mover");
                const section = document.getElementById(HOME_PAG.SCALING);
                const checkMark = () => {
                    if (!mark || !section) return;
                    const r = mark.getBoundingClientRect();
                    const clip = section.getBoundingClientRect();
                    const top = Math.max(0, clip.top);
                    const bottom = Math.min(window.innerHeight, clip.bottom);
                    if (r.top >= top && r.bottom <= bottom) logoAnimation.play();
                    else if (r.top < top && clip.top > 0) logoAnimation.finish();
                };
                gsap.ticker.add(checkMark);
                return () => gsap.ticker.remove(checkMark);
            }
        },
        { scope: scalingRef }
    );

    React.useEffect(() => {
        if (canvasRef.current) {
            const dots = new SequentialDots(canvasRef.current, {
                dotSize: [6, 4],
                cols: 100,
                fadeSpeed: 0.015,
                moveSpeed: 0.25,
                margin: 50,
                colors: ["#D1127A", "#FFC236", "#C2410C", "#1A1014"],
            });
            return () => dots.destroy();
        }
    }, []);

    return (
        <section className={css.scaling} id={HOME_PAG.SCALING}>
            <div id="scaling-wrapper" ref={scalingRef}>
                <div className={css.scalling_wrapper}>
                    <Image.Default
                        src="/img/home-new/scaling-lines.webp"
                        className={css.scaling_lines}
                        alt=""
                    />
                    <Rays className={css.scaling_rays} id="scalling-rays" />
                    <div className={css.scaling_screen}>
                        <canvas
                            ref={canvasRef}
                            className={css.scaling_canvas}
                        />
                        <div className={css.scaling_main}>
                            <div
                                className={css.scaling_main_iconWrapper}
                                id="steps-mark"
                            >
                                <div
                                    className={css.scaling_main_iconMover}
                                    id="steps-mark-mover"
                                >
                                    <div className={css.scaling_main_icon}>
                                        <DayzroOutline id="steps-mark-dayzro" />
                                    </div>
                                    <div className={css.scaling_main_eth}>
                                        <UsdcOutline id="steps-mark-usdc" />
                                    </div>
                                </div>
                            </div>
                            <div className={css.scaling_main_label}>
                                {data.solution_screen_1_suptitle}
                            </div>
                            <h2
                                className={css.scaling_main_title}
                                dangerouslySetInnerHTML={{
                                    __html: data.solution_screen_1_title,
                                }}
                            />
                        </div>
                    </div>
                    <div className={css.scaling_screen}>
                        <div className={css.scaling_dao}>
                            <div className={`${css.scaling_copy} ${css.scaling_dao_copy}`}>
                                <h2
                                    className={css.scaling_dao_title}
                                    dangerouslySetInnerHTML={{
                                        __html: data.solution_screen_2_title,
                                    }}
                                />
                                <p className={css.scaling_text}>{data.solution_screen_2_text}</p>
                            </div>
                        </div>
                    </div>
                    <div className={css.scaling_screen}>
                        <div className={`${css.scaling_token} ${css.scaling_copy}`}>
                            <h2
                                className={css.scaling_token_title}
                                dangerouslySetInnerHTML={{
                                    __html: data.solution_screen_3_title,
                                }}
                            />
                            <p className={css.scaling_text}>{data.solution_screen_3_text}</p>
                        </div>
                    </div>
                    <div className={css.scaling_screen}>
                        <div className={css.scaling_community}>
                            <div className={`${css.scaling_community_inner} ${css.scaling_copy}`}>
                                <h2
                                    className={css.scaling_community_title}
                                    dangerouslySetInnerHTML={{
                                        __html: data.solution_screen_4_title,
                                    }}
                                />
                                <p className={css.scaling_text}>{data.solution_screen_4_text}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
