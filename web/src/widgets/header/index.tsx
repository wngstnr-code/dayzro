'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/buttons/button";
import { DayzroLogo } from "@/components/dayzro-logo";
import css from "./header.module.scss";

export const Header: React.FC = () => {
    const [scrolled, setScrolled] = useState(false);

    // Blur once the page leaves the top.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className={`${css.header} ${scrolled ? css.header_scrolled : ""}`}>
            <div className="container">
                <div className={css.header_wrapper}>
                    <Link className={css.header_logo} prefetch={false} href="/" aria-label="Dayzro home">
                        <DayzroLogo />
                    </Link>

                    {/* Plain anchor: /app has its own root layout, so this is a full page load. */}
                    <Button component="a" href="/app" text="Launch App" hoverRoll className={css.header_cta} />
                </div>
            </div>
        </header>
    );
};
