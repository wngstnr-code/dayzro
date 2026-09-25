"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";
import { Screens } from "@/widgets/home-screens";
import { DefaultLayout } from "@/widgets/layouts/default-layout";
import { MediaQuery } from "@/components/media-query";
import { WrapSVG } from "@/widgets/home-screens/components/WrapSVG";
import css from "./home.module.scss";

const HomePagination = dynamic(
    () => import("@/widgets/home-screens/components/HomePagination"),
    { ssr: false }
);

export default function Home() {
    return (
        <DefaultLayout className={clsx(css.root)}>
            <MediaQuery query="(min-width: 991px)">
                <HomePagination />
            </MediaQuery>
            <Screens.Hero />
            <Screens.Scaling />
            <WrapSVG>
                <Screens.About />
                <Screens.Journey />
                <Screens.Governance />
            </WrapSVG>
        </DefaultLayout>
    );
}
