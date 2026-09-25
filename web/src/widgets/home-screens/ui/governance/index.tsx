"use client";

import React from "react";
import { HOME_PAG } from "@/widgets/home-screens/lib";
import { homePageData } from "@/content/pages/home";
import css from "./governance.module.scss";

export const Governance: React.FC = () => {
    const data = homePageData;

    return (
        <section className={css.governance} id={HOME_PAG.GOVERNANCE}>
            <div className={css.governance_container}>
                <p className={css.governance_label}>
                    {data.governance_suptitle}
                </p>
                <h2 className={css.governance_title}>
                    {data.governance_title}
                </h2>
                <p className={css.governance_text}>
                    {data.governance_text}
                </p>
                <video
                    className={css.governance_video}
                    src="/img/home-new/governance/governance.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                />
            </div>
        </section>
    );
};
