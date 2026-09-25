'use client';

import React from "react";
import ArrowLinkIcon from "@/components/icons/arrow-link";
import { NextLink } from "@/components/next-link";
import { DayzroLogo } from "@/components/dayzro-logo";
import css from "./footer.module.scss";

const REPO = "https://github.com/wngstnr-code/dayzro";
const EXPLORER = "https://explorer.arc.io";

// Only real destinations: sections of this page, the repo, the Arc explorer and the hackathon.
const footerNavigation = [
    {
        name: "Product",
        links: [
            { name: "Launch App", href: "/app" },
            { name: "How it works", href: "#scaling" },
            { name: "Who it's for", href: "#journey" },
            { name: "Trust", href: "#governance" },
        ],
    },
    {
        name: "Developers",
        links: [
            { name: "Source code", href: REPO },
            { name: "Smart contracts", href: `${REPO}/tree/main/contracts/src` },
            { name: "Contract design", href: `${REPO}/blob/main/docs/design.md` },
            { name: "Test suite", href: `${REPO}/tree/main/contracts/test` },
        ],
    },
    {
        name: "Network",
        links: [
            { name: "Arc Explorer", href: EXPLORER },
            { name: "USDC on Arc", href: `${EXPLORER}/token/0x3600000000000000000000000000000000000000` },
            { name: "EURC on Arc", href: `${EXPLORER}/token/0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` },
        ],
    },
    {
        name: "Hackathon",
        links: [{ name: "Arc Microgrants", href: "https://dorahacks.io/hackathon/arc-microgrants/detail" }],
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
                            <DayzroLogo size="lg" className={css.footer_content_logo} />
                            <p className={css.footer_content_text}>
                                Onchain receivables on Arc. Suppliers get paid on day zero, financiers earn from real trade.
                            </p>
                        </div>
                        <div className={css.footer_nav}>
                            {footerNavigation.map((group) => (
                                <div className={css.footer_nav_group} key={group.name}>
                                    <p className={css.footer_nav_title}>{group.name}</p>
                                    <div className={css.footer_nav_list}>
                                        {group.links.map((link) => {
                                            const external = link.href.startsWith("http");
                                            return (
                                                <NextLink
                                                    className={css.footer_nav_link}
                                                    href={link.href}
                                                    target={external ? "_blank" : undefined}
                                                    key={link.name}
                                                >
                                                    {link.name}
                                                    {external && <ArrowLinkIcon />}
                                                </NextLink>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={css.footer_bottom}>
                        <p>&copy; {new Date().getFullYear()} Dayzro</p>
                        <p>Built on Arc. Open source under MIT.</p>
                    </div>

                    <p className={css.footer_wordmark} aria-hidden>
                        Dayzro
                    </p>
                </div>
            </div>
        </footer>
    );
};
