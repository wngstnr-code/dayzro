'use client';

import React, { useEffect } from 'react';
import { ModalProvider } from '@/components/modal';
import { animateOnScroll } from '@/lib/utils/aos';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    useEffect(() => {
        const animate = animateOnScroll({
            activeClass: "--animate",
            triggerClass: "aos",
            triggerOnce: true,
        });

        return () => animate.destroy();
    }, []);

    return (
        <ModalProvider>
            {children}
        </ModalProvider>
    );
};
