"use client";

import React from "react";
import css from "./journey-item.module.scss";
import clsx from "clsx";

interface Props {
    title: string;
    content: string[];
    className?: string;
    progress: number;
    variant?: "magenta" | "sunrise" | "gold";
    /** Same box for every card: fixed width and a shared minimum list height. */
    uniform?: boolean;
}

export const JourneyItem: React.FC<Props> = ({
    content,
    title,
    className,
    variant = "magenta",
    progress,
    uniform = false,
}) => {
    return (
        <div
            className={clsx(
                "journey-item",
                css.item,
                css["_" + variant],
                uniform && css._uniform,
                className
            )}
        >
            <div className={css.item_title}>{title}</div>
            <div
                className={clsx(css.item_content, "journey-item-content")}
                data-progress={progress}
            >
                <ul className={css.item_list}>
                    {content.map((item) => (
                        <li className={css.item_list_point} key={item}>
                            <span dangerouslySetInnerHTML={{ __html: item }} />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
