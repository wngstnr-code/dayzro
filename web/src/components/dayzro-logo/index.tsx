import React from "react";
import clsx from "clsx";
import { DayzroMark } from "@/brand/dayzro-mark";
import css from "./dayzro-logo.module.scss";

type Props = {
    className?: string;
    /** "md" for the navbar, "lg" for the footer brand block. */
    size?: "md" | "lg";
};

export const DayzroLogo: React.FC<Props> = ({ className, size = "md" }) => (
    <span className={clsx(css.logo, size === "lg" && css._lg, className)}>
        <DayzroMark size={30} className={css.logo_mark} />
        <span className={css.logo_text}>Dayzro</span>
    </span>
);
