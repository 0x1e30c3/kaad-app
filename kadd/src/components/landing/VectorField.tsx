"use client";
import { useEffect, useRef } from "react";

type Props = {
  lineColor?: string;
  lineWeight?: number;
  /** Grid spacing in px; larger = fewer lines (and cheaper frames). */
  proximity?: number;
  vectorSize?: number;
  className?: string;
};

/**
 * A grid of short strokes that swirl around the pointer. Fills its parent, follows the pointer with a little lag, only
 * animates while on screen, and draws one still frame when the visitor prefers reduced motion.
 */
export default function VectorField({ lineColor = "#836ef9", lineWeight = 1.5, proximity = 18, vectorSize = 9, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let points: { x: number; y: number }[] = [];
    const target = { x: 0, y: 0 }; // where the pointer is
    const eye = { x: 0, y: 0 }; // where the swirl is: eases toward the pointer
    let raf = 0;
    let visible = false;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = [];
      for (let y = 0; y <= h + proximity; y += proximity) for (let x = 0; x <= w + proximity; x += proximity) points.push({ x, y });
      if (!target.x && !target.y) {
        Object.assign(target, { x: w / 2, y: h / 2 }); // swirl starts centred until the pointer moves
        Object.assign(eye, target);
      }
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWeight;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const p of points) {
        const dx = p.x - eye.x;
        const dy = p.y - eye.y;
        const heading = Math.atan2(-dx - dy, dy - dx); // perpendicular-ish to the pointer: a vortex around it
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + vectorSize * Math.cos(heading), p.y + vectorSize * Math.sin(heading));
      }
      ctx.stroke();
    };

    const loop = () => {
      eye.x += (target.x - eye.x) * 0.08;
      eye.y += (target.y - eye.y) * 0.08;
      draw();
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !still && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    if (!still) addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", onMove);
    };
  }, [lineColor, lineWeight, proximity, vectorSize]);

  return <canvas ref={canvasRef} aria-hidden className={`block h-full w-full ${className}`} />;
}
