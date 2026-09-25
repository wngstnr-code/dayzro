"use client";

import type { ReactNode } from "react";
import { cn } from "@/dapp/lib/cn";
import { useIsDesktopOrLarger } from "@/dapp/lib/hooks";

const glassCard = `
    w-full
    md:card
    md:rounded-[20px]
    md:border
    md:border-divider-border
    md:glassy-gradient-card
    dark:md:dark-glass-background-gradient
    light:md:light-glass-background-gradient
`;

type CardProps = {
    title?: string;
    text?: string;
    className?: string;
    children?: ReactNode;
};

export function Card({ title, text, className, children }: CardProps) {
    const isDesktop = useIsDesktopOrLarger();
    const glow = isDesktop ? { "data-glow-border": true } : {};

    return (
        <div className={cn(glassCard, className)}>
            <div {...glow} className="card-body body-regular px-4 md:p-[50px] gap-0 py-0 md:mt-[0px] mt-[40px]">
                {title && <h2 className="card-title title-screen-bold">{title}</h2>}
                {text && <p className="text-secondary-content">{text}</p>}
                <div className="f-col">{children}</div>
            </div>
        </div>
    );
}

export function Stepper({ className, children }: { className?: string; children: ReactNode }) {
    const isDesktop = useIsDesktopOrLarger();
    const glow = isDesktop ? { "data-glow-border": true } : {};

    return (
        <div className={cn("md:w-[524px]", glassCard, className)}>
            <div {...glow} className="card-body body-regular gap-0 p-0">
                <ul className="steps md:mb-[30px] mt-[30px]">{children}</ul>
            </div>
        </div>
    );
}

type StepProps = {
    stepIndex: number;
    currentStepIndex: number;
    isActive?: boolean;
    children: ReactNode;
};

export function Step({ stepIndex, currentStepIndex, isActive = false, children }: StepProps) {
    return (
        <li
            data-content=""
            className={cn(
                "step dz-step",
                isActive && "step-primary",
                stepIndex < currentStepIndex && !isActive && "step-previous",
            )}>
            {children}
        </li>
    );
}
