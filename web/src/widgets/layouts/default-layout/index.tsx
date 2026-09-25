'use client';

import React from "react";
import { Header } from "@/widgets/header";
import { Footer } from "@/widgets/footer";

interface Props {
    children: React.ReactNode;
    className?: string;
}

export const DefaultLayout: React.FC<Props> = ({ children, className }) => {
    return (
        <div className={className}>
            <Header />
            {children}
            <Footer />
        </div>
    );
};
