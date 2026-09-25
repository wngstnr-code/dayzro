'use client';

import React, { useEffect, useState } from 'react';

interface MediaQueryProps {
    query: string;
    children: React.ReactNode;
    onUpdate?: () => void;
}

export const MediaQuery: React.FC<MediaQueryProps> = ({
    children,
    query,
    onUpdate,
}) => {
    const [isRender, setRender] = useState(false);

    useEffect(() => {
        const onResize = () => {
            const innerWidth = document.documentElement.getBoundingClientRect().width;
            const queries = query.split(/\s?and\s?/g);
            let render = true;

            for (const q of queries) {
                const isMax = q.includes('max-width');
                const isMin = q.includes('min-width');
                const px = +(q.match(/\d+/gi) || '0').toString();

                if (
                    (isMax && innerWidth > px) ||
                    (isMin && innerWidth < px)
                ) render = false;
            }

            if (isRender !== render && onUpdate) {
                onUpdate();
            }

            setRender(render);
        };

        onResize();

        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });

    return isRender ? <>{children}</> : null;
};
