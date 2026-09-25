"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/dapp/lib/cn";
import { Icon } from "./Icon";

export function Spinner({ className }: { className?: string }) {
    return <span className={cn("w-6 h-6", "loading loading-spinner", className)} />;
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    priority: "primary" | "secondary";
    loading?: boolean;
    onPopup?: boolean;
};

export function ActionButton({
    priority,
    loading = false,
    onPopup = false,
    disabled,
    className,
    children,
    ...rest
}: ActionButtonProps) {
    const common = cn(
        "btn size-[56px] px-[28px] py-[14px] rounded-full flex-1 w-full items-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        onPopup && disabled ? "!bg-dialog-interactive-disabled" : "",
        className,
    );
    const primary = "btn-primary text-white border-none";
    const secondary = disabled
        ? "border-none"
        : "border-primary-brand dark:text-white hover:bg-primary-interactive-hover btn-secondary bg-transparent light:text-black";

    return (
        <button
            {...rest}
            disabled={disabled}
            className={cn(common, priority === "primary" ? primary : secondary, className)}>
            {loading && <Spinner />}
            {children}
        </button>
    );
}

type LinkButtonProps = {
    href: string;
    active?: boolean;
    external?: boolean;
    className?: string;
    onClick?: () => void;
    children: ReactNode;
};

export function LinkButton({ href, active = false, external = false, className, onClick, children }: LinkButtonProps) {
    const activeClass = active
        ? "body-bold bg-primary-interactive text-grey-10 hover:!bg-primary-interactive hover:!text-grey-10"
        : "body-regular hover:bg-primary-interactive-hover";
    const classes = cn("p-3 rounded-full flex justify-start content-center", activeClass, className);

    const content = (
        <>
            {children}
            {external && (
                <div className="flex flex-grow justify-end">
                    <Icon type="arrow-top-right" className="justify-self-end" />
                </div>
            )}
        </>
    );

    if (external) {
        return (
            <a href={href} target="_blank" rel="noreferrer" className={classes} onClick={onClick}>
                {content}
            </a>
        );
    }
    return (
        <Link href={href} className={classes} onClick={onClick}>
            {content}
        </Link>
    );
}

export function StepBack({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
    return (
        <button onClick={onClick} className="flex justify-center link">
            {children}
        </button>
    );
}
