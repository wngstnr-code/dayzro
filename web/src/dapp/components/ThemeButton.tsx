"use client";

import { useTheme } from "@/dapp/lib/theme";
import { Icon } from "./Icon";

export function ThemeButton({ mobile = false }: { mobile?: boolean }) {
    const { theme, toggle } = useTheme();
    const isDarkTheme = theme === "dark";
    const darkFill = isDarkTheme ? "fill-grey-600" : "fill-grey-0";
    const lightFill = isDarkTheme ? "fill-grey-0" : "fill-grey-600";

    if (mobile) {
        return (
            <label className="cursor-pointer grid place-items-center">
                <input
                    type="checkbox"
                    checked={isDarkTheme}
                    onChange={toggle}
                    className="toggle toggle-md toggle-grey-600 row-start-1 col-start-1 col-span-2 theme-controller bg-grey-0 border-grey-600 [--tglbg:theme(colors.grey.600)] checked:bg-grey-0 checked:border-blue-800 checked:[--tglbg:theme(colors.grey.600)] hover:bg-grey-0"
                />
                <Icon type="moon" className="col-start-2 row-start-1" size={16} fillClass={darkFill} />
                <Icon type="sun" className="col-start-1 row-start-1" size={16} fillClass={lightFill} />
            </label>
        );
    }

    return (
        <label className="swap swap-rotate">
            <input type="checkbox" className="border-none" checked={isDarkTheme} onChange={toggle} />
            <Icon type="sun" className="fill-primary-icon swap-on" size={25} />
            <Icon type="moon" className="fill-primary-icon swap-off" size={25} />
        </label>
    );
}
