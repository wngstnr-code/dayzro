'use client';

import React from "react";
import ArrowLinkIcon from "@/components/icons/arrow-link";
import { NextLink } from "@/components/next-link";
import css from "./footer.module.scss";

const footerNavigation = [
    {
        name: "Product",
        links: [
            { name: "Launch App", href: "/app" },
            { name: "Source code", href: "https://github.com/wngstnr-code/dayzro" },
        ],
    },
    {
        name: "Network",
        links: [{ name: "Arc Explorer", href: "https://explorer.arc.io" }],
    },
];

export const Footer: React.FC = () => {
    return (
        <footer className={css.footer} id="footer">
            <div className="container">
                <div className={css.footer_wrapper}>
                    <p className={css.footer_title}>
                        Get paid on <b>day zero</b>
                    </p>
                    <div className={css.footer_row}>
                        <div className={css.footer_content}>
                            <p className={css.footer_content_title}>Dayzro</p>
                            <p className={css.footer_content_text}>
                                Onchain receivables on Arc. Suppliers get paid on day zero, financiers earn from real trade.
                            </p>
                        </div>
                        <div className={css.footer_nav}>
                            <div className={css.footer_nav_inner}>
                                {footerNavigation.map((group) => (
                                    <div className={css.footer_nav_group} key={group.name}>
                                        <p className={css.footer_nav_title}>{group.name}</p>
                                        <div className={css.footer_nav_list}>
                                            {group.links.map((link) => (
                                                <NextLink
                                                    className={css.footer_nav_link}
                                                    href={link.href}
                                                    target={
                                                        link.href.startsWith("http")
                                                            ? "_blank"
                                                            : undefined
                                                    }
                                                    key={link.name + link.href}
                                                >
                                                    <span className={css.footer_nav_link_left}>
                                                        <span className={css.footer_nav_link_name}>
                                                            {link.name}
                                                            {link.href.startsWith("http") && (
                                                                <ArrowLinkIcon />
                                                            )}
                                                        </span>
                                                    </span>
                                                </NextLink>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <p className={css.footer_copyright}>
                        &copy; {new Date().getFullYear()} Dayzro
                    </p>
                </div>
            </div>
        </footer>
    );
};
