"use client";

import React, { useEffect, useRef, useState } from "react";
import { DayzroMark } from "@/brand/dayzro-mark";
import { brand } from "@/brand/tokens";
import css from "./dayzro-logo-3d.module.scss";

/*
 * Live WebGL version of the Dayzro mark (src/brand/dayzro-mark.tsx), built from the
 * same 48x48 SVG geometry: extruded "0" ring, horizon bar, half sun and three rays.
 * Falls back to the flat SVG mark when WebGL is unavailable.
 */

type Props = { className?: string; id?: string };

export const DayzroLogo3D: React.FC<Props> = ({ className, id }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const [fallback, setFallback] = useState(false);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        let disposed = false;
        let cleanup = () => {};

        import("three").then((THREE) =>
            import("three/examples/jsm/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => {
                if (disposed) return;

                let renderer: InstanceType<typeof THREE.WebGLRenderer>;
                try {
                    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
                } catch {
                    setFallback(true);
                    return;
                }

                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.toneMapping = THREE.NeutralToneMapping;
                renderer.toneMappingExposure = 0.95;
                renderer.domElement.className = css.canvas;
                host.appendChild(renderer.domElement);

                const scene = new THREE.Scene();
                const pmrem = new THREE.PMREMGenerator(renderer);
                const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
                scene.environment = envTex;
                scene.environmentIntensity = 0.55;

                const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
                camera.position.set(0, 0, 112);

                const key = new THREE.DirectionalLight(0xffffff, 1.6);
                key.position.set(-30, 50, 80);
                scene.add(key);
                const rim = new THREE.DirectionalLight(new THREE.Color(brand.sunrise), 2.2);
                rim.position.set(40, -20, -40);
                scene.add(rim);

                // --- Geometry, in SVG units (48x48 viewBox, y down). toX/toY center it and flip y.
                const toX = (x: number) => x - 24;
                const toY = (y: number) => 24 - y;

                const roundedRect = (x: number, y: number, w: number, h: number, r: number, path: InstanceType<typeof THREE.Path>) => {
                    const l = toX(x), rt = toX(x + w), t = toY(y), b = toY(y + h);
                    path.moveTo(l + r, t);
                    path.lineTo(rt - r, t);
                    path.absarc(rt - r, t - r, r, Math.PI / 2, 0, true);
                    path.lineTo(rt, b + r);
                    path.absarc(rt - r, b + r, r, 0, -Math.PI / 2, true);
                    path.lineTo(l + r, b);
                    path.absarc(l + r, b + r, r, -Math.PI / 2, -Math.PI, true);
                    path.lineTo(l, t - r);
                    path.absarc(l + r, t - r, r, Math.PI, Math.PI / 2, true);
                    return path;
                };

                // Capsule between two SVG points with the given stroke width (round caps).
                const capsule = (x1: number, y1: number, x2: number, y2: number, w: number) => {
                    const ax = toX(x1), ay = toY(y1), bx = toX(x2), by = toY(y2);
                    const ang = Math.atan2(by - ay, bx - ax);
                    const r = w / 2;
                    const s = new THREE.Shape();
                    s.absarc(bx, by, r, ang - Math.PI / 2, ang + Math.PI / 2, false);
                    s.absarc(ax, ay, r, ang + Math.PI / 2, ang + (3 * Math.PI) / 2, false);
                    s.closePath();
                    return s;
                };

                // Ring: stroke 5 centered on rect(8, 3.5, 32, 41, rx 16).
                const ring = roundedRect(5.5, 1, 37, 46, 18.5, new THREE.Shape()) as InstanceType<typeof THREE.Shape>;
                ring.holes.push(roundedRect(10.5, 6, 27, 36, 13.5, new THREE.Path()));

                // Horizon bar (its round caps sit inside the ring, so a plain bar is enough) + half sun.
                const horizon = new THREE.Shape();
                horizon.moveTo(toX(10.2), toY(27.4));
                horizon.lineTo(toX(37.8), toY(27.4));
                horizon.lineTo(toX(37.8), toY(30.6));
                horizon.lineTo(toX(10.2), toY(30.6));
                horizon.closePath();

                const sun = new THREE.Shape();
                sun.moveTo(toX(16.5), toY(29));
                sun.absarc(toX(24), toY(29), 7.5, Math.PI, 0, true);
                sun.closePath();

                const rays = [
                    capsule(24, 15.5, 24, 18.9, 2.6),
                    capsule(15.2, 19.4, 17.6, 21.8, 2.6),
                    capsule(32.8, 19.4, 30.4, 21.8, 2.6),
                ];

                const DEPTH = 6;
                const extrude = (shapes: InstanceType<typeof THREE.Shape>[], bevel: number) => {
                    const g = new THREE.ExtrudeGeometry(shapes, {
                        depth: DEPTH,
                        curveSegments: 48,
                        bevelEnabled: true,
                        bevelThickness: bevel,
                        bevelSize: bevel,
                        bevelOffset: -bevel,
                        bevelSegments: 6,
                    });
                    g.translate(0, 0, -DEPTH / 2);
                    return g;
                };

                // Vertical sunrise -> magenta gradient baked into vertex colors (matches the SVG gradient).
                const top = new THREE.Color(brand.sunrise);
                const bottom = new THREE.Color(brand.magenta);
                const paint = <G extends InstanceType<typeof THREE.ExtrudeGeometry>>(g: G): G => {
                    const pos = g.getAttribute("position");
                    const col = new Float32Array(pos.count * 3);
                    const c = new THREE.Color();
                    for (let i = 0; i < pos.count; i++) {
                        const t = THREE.MathUtils.clamp((toY(3) - pos.getY(i)) / 42, 0, 1);
                        c.copy(top).lerp(bottom, t);
                        col.set([c.r, c.g, c.b], i * 3);
                    }
                    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
                    return g;
                };

                const bodyMat = new THREE.MeshPhysicalMaterial({
                    vertexColors: true,
                    metalness: 0.05,
                    roughness: 0.3,
                    clearcoat: 1,
                    clearcoatRoughness: 0.08,
                });
                const sunMat = bodyMat.clone();
                sunMat.emissive = new THREE.Color(brand.sunrise);
                sunMat.emissiveIntensity = 0.25;

                const logo = new THREE.Group();
                const geos = [paint(extrude([ring, horizon], 0.9)), paint(extrude([sun, ...rays], 0.6))];
                logo.add(new THREE.Mesh(geos[0], bodyMat));
                logo.add(new THREE.Mesh(geos[1], sunMat));

                // Soft sun glow behind the disc (the SVG's radial glow), additive so it only brightens.
                const glowCanvas = document.createElement("canvas");
                glowCanvas.width = glowCanvas.height = 256;
                const gctx = glowCanvas.getContext("2d")!;
                const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
                grad.addColorStop(0, "rgba(255,138,61,0.55)");
                grad.addColorStop(0.45, "rgba(255,138,61,0.16)");
                grad.addColorStop(1, "rgba(255,138,61,0)");
                gctx.fillStyle = grad;
                gctx.fillRect(0, 0, 256, 256);
                const glowTex = new THREE.CanvasTexture(glowCanvas);
                glowTex.colorSpace = THREE.SRGBColorSpace;
                const glowMat = new THREE.MeshBasicMaterial({
                    map: glowTex,
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                });
                const glow = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), glowMat);
                glow.position.set(0, toY(25), -DEPTH / 2 - 0.5);
                logo.add(glow);
                // Near front view with a slight tilt so the extrusion depth reads.
                logo.rotation.set(0.1, -0.16, 0);
                scene.add(logo);

                // --- Near front view that floats: slow bob plus a tiny sway, paused off screen.
                const resize = () => {
                    const { width, height } = host.getBoundingClientRect();
                    if (!width || !height) return;
                    renderer.setSize(width, height, false);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                    renderer.render(scene, camera);
                };
                resize();
                const ro = new ResizeObserver(resize);
                ro.observe(host);

                const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                let visible = true;
                const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
                io.observe(host);

                const clock = new THREE.Clock();
                let raf = 0;
                const tick = () => {
                    raf = requestAnimationFrame(tick);
                    if (!visible) return;
                    const t = clock.getElapsedTime();
                    logo.position.y = Math.sin(t * 1.1) * 1.6;
                    logo.rotation.x = 0.1 + Math.sin(t * 1.1 + 0.8) * 0.04;
                    logo.rotation.y = -0.16 + Math.sin(t * 0.7) * 0.06;
                    logo.rotation.z = Math.sin(t * 0.9) * 0.02;
                    renderer.render(scene, camera);
                };
                if (!reduced) tick();

                cleanup = () => {
                    cancelAnimationFrame(raf);
                    io.disconnect();
                    ro.disconnect();
                    geos.forEach((g) => g.dispose());
                    glow.geometry.dispose();
                    [bodyMat, sunMat, glowMat].forEach((m) => m.dispose());
                    glowTex.dispose();
                    envTex.dispose();
                    pmrem.dispose();
                    renderer.dispose();
                    renderer.domElement.remove();
                };
            })
        ).catch(() => setFallback(true));

        return () => {
            disposed = true;
            cleanup();
        };
    }, []);

    return (
        <div ref={hostRef} id={id} className={`${css.host} ${className ?? ""}`} role="img" aria-label="Dayzro">
            {fallback && <DayzroMark size={256} className={css.fallback} />}
        </div>
    );
};
