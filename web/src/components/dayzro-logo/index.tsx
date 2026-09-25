import React from "react";
import clsx from "clsx";
import { DayzroMark } from "@/brand/dayzro-mark";
import css from "./dayzro-logo.module.scss";

type Props = {
    className?: string;
};

export const DayzroLogo: React.FC<Props> = ({ className }) => (
    <span className={clsx(css.logo, className)}>
        <DayzroMark size={30} className={css.logo_mark} />
        <span className={css.logo_text}>Dayzro</span>
    </span>
);
