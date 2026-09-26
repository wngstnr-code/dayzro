"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/dapp/lib/cn";
import { ActionButton, LinkButton } from "./Buttons";
import { ConnectButton } from "./ConnectButton";
import { Icon, type IconType } from "./Icon";
import { LogoWithText } from "./Logo";
import { ThemeButton } from "./ThemeButton";

export const drawerToggleId = "side-drawer-toggle";

type NavTab = { href: string; icon: IconType; label: string };

// Same structure as the bridge UI's navigationItems.ts, with Dayzro's pages.
const sideNavigationTabs: NavTab[] = [
    { href: "/app", icon: "plus-circle", label: "New invoice" },
    { href: "/app/invoices", icon: "transactions", label: "Invoices" },
    { href: "/app/finance", icon: "cards", label: "Finance" },
    { href: "/app/b", icon: "user-circle", label: "Buyer profile" },
];

const externalTabs: NavTab[] = [
    { href: "https://explorer.arc.io", icon: "explorer", label: "Explorer" },
    { href: "https://github.com/wngstnr-code/dayzro#readme", icon: "guide", label: "Guide" },
];

// Detail pages live under their section: /app/b/0x... keeps "Buyer profile" active.
function isActive(pathname: string, href: string) {
    return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

// The two sides that start a flow: suppliers issue invoices, financiers fund them.
const headerTabs = [
    { href: "/app", label: "Supplier" },
    { href: "/app/finance", label: "Financier" },
];

export function HeaderTabs({ className, onClick }: { className?: string; onClick?: () => void }) {
    const pathname = usePathname();
    return (
        <div className={cn("space-x-2", className)}>
            {headerTabs.map((tab) => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={onClick}
                    className={cn(
                        isActive(pathname, tab.href) ? "btn-primary text-white" : "btn-ghost",
                        "btn h-[40px] px-[28px] rounded-full",
                    )}>
                    <span>{tab.label}</span>
                </Link>
            ))}
        </div>
    );
}

// Lives inside the <label> for the drawer toggle, so a click flips the checkbox (and sideBarOpen) natively.
function IconFlipper({ flipped }: { flipped: boolean }) {
    return (
        <div role="button" tabIndex={0} className="swap btn-neutral swap-rotate w-9 h-9 rounded-full">
            <input type="checkbox" className="border-none" checked={!flipped} readOnly />
            <Icon type="bars-menu" className="fill-primary-icon swap-on" size={20} />
            <Icon type="x-close" className="fill-primary-icon swap-off" size={20} />
        </div>
    );
}

function Header({ sideBarOpen }: { sideBarOpen: boolean }) {
    return (
        <header className="sticky-top f-between-center justify-between z-30 px-4 py-[20px] glassy-background bg-grey-5/10 dark:bg-grey-900/10 lg:px-10 lg:py-7">
            <div className="flex justify-between items-center w-full">
                <div className="lg:w-[226px] w-auto">
                    <LogoWithText />
                </div>
                <HeaderTabs className="hidden lg:flex md:flex-1" />
                <div className="f-row">
                    <ConnectButton className="justify-self-end" />
                    <div className="hidden lg:inline-flex">
                        <div className="v-sep my-auto mx-[8px] h-[24px]" />
                        <ThemeButton />
                    </div>
                </div>
            </div>
            <label htmlFor={drawerToggleId} className="ml-[10px] lg:hidden">
                <IconFlipper flipped={sideBarOpen} />
            </label>
        </header>
    );
}

function SideNavigation({
    sideBarOpen,
    setSideBarOpen,
    children,
}: {
    sideBarOpen: boolean;
    setSideBarOpen: (open: boolean) => void;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const close = () => setSideBarOpen(false);
    const fill = (active: boolean) => (active ? "fill-white" : "fill-primary-icon");

    return (
        <div className="drawer lg:drawer-open">
            <input
                id={drawerToggleId}
                type="checkbox"
                className="drawer-toggle"
                checked={sideBarOpen}
                onChange={(e) => setSideBarOpen(e.target.checked)}
            />
            <div className="drawer-content relative f-col w-full">{children}</div>

            <div className="drawer-side z-20 pt-[81px] lg:pt-[20px] h-full">
                <label htmlFor={drawerToggleId} className="drawer-overlay" />
                <div className="w-full !duration-100">
                    <aside className="h-full px-[20px] lg:mt-0 lg:px-4 lg:w-[226px]">
                        <div className="hidden lg:inline-block" />
                        <div role="button" tabIndex={0} onClick={close} onKeyDown={close}>
                            <HeaderTabs className="lg:hidden flex flex-1 mb-[40px] mt-[20px]" onClick={close} />
                        </div>
                        <div role="button" tabIndex={0} onClick={close} onKeyDown={(e) => e.key === "Escape" && close()}>
                            <ul className="menu p-0 space-y-2">
                                {sideNavigationTabs.map((tab) => {
                                    const active = isActive(pathname, tab.href);
                                    return (
                                        <li key={tab.href}>
                                            <LinkButton href={tab.href} active={active} onClick={close}>
                                                <Icon type={tab.icon} fillClass={fill(active)} />
                                                <span>{tab.label}</span>
                                            </LinkButton>
                                        </li>
                                    );
                                })}
                                {externalTabs.map((tab, i) => (
                                    <li key={tab.href} className={i === 0 ? "border-t border-t-divider-border pt-2" : ""}>
                                        <LinkButton href={tab.href} external>
                                            <Icon type={tab.icon} />
                                            <span>{tab.label}</span>
                                        </LinkButton>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <ul>
                            <li>
                                <div className="p-3 rounded-full flex lg:hidden justify-start content-center">
                                    <Icon type="settings" />
                                    <div className="flex justify-between w-full pl-[6px]">
                                        <span className="text-base">Theme</span>
                                        <ThemeButton mobile />
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </aside>
                </div>
            </div>
        </div>
    );
}

/** Root chrome of the app: header, side navigation and the pointer-driven glow borders. */
export function AppShell({ children }: { children: ReactNode }) {
    const [sideBarOpen, setSideBarOpen] = useState(false);

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 1200px)");
        const syncPointer = ({ x, y }: PointerEvent) => {
            const root = document.documentElement.style;
            root.setProperty("--x", x.toFixed(2));
            root.setProperty("--xp", (x / window.innerWidth).toFixed(2));
            root.setProperty("--y", y.toFixed(2));
            root.setProperty("--yp", (y / window.innerHeight).toFixed(2));
        };
        if (desktop.matches) document.body.addEventListener("pointermove", syncPointer);
        return () => document.body.removeEventListener("pointermove", syncPointer);
    }, []);

    return (
        <>
            <Header sideBarOpen={sideBarOpen} />
            <SideNavigation sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen}>
                <main>{children}</main>
            </SideNavigation>
        </>
    );
}

export function Page({ children }: { children: ReactNode }) {
    return <div className="f-center w-full px-0 md:px-10 md:py-[40px]">{children}</div>;
}

export { ActionButton };
