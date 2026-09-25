"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

type ThemeContextValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggle: () => {} });

/**
 * Inline script for <head>, identical in behaviour to the bridge UI's app.html:
 * applies the stored or preferred theme before first paint to avoid a flash.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = (stored && stored.toLowerCase() === 'dark') ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("dark");

    useEffect(() => {
        const current = document.documentElement.getAttribute("data-theme");
        setTheme(current === "light" ? "light" : "dark");
    }, []);

    const toggle = useCallback(() => {
        setTheme((prev) => {
            const next: Theme = prev === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            try {
                localStorage.setItem("theme", next);
            } catch {}
            window.dispatchEvent(new CustomEvent("dz-theme", { detail: next }));
            return next;
        });
    }, []);

    return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
