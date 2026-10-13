"use client";
import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/**
 * Scroll choreography for everything below the hero, driven by data attributes so the markup stays static:
 *   data-anim="lines"   heading rises line by line from behind a mask
 *   data-anim="words"   statement words brighten from faint to full as you scroll through it (scrubbed)
 *   data-anim="rise"    children rise in with a stagger
 *   data-anim="stack"   children slide up a few pixels, one after another (small UI mockups)
 *   data-anim="hairline" a 1px rule draws itself from the left
 *   data-steps          a numbered sequence: each [data-step] lights up in turn, its [data-steps-line] to the next drawing between
 *   data-draw="0.77"    an SVG stroke draws to that fraction of its length (the markup holds the final state)
 *   data-fill           a bar grows from the left to the width the markup gives it
 *   data-pop            its [data-pop-item]s pop in one by one
 *   data-parallax       image drifts inside its frame while the frame scrolls by
 *   data-stickers / data-sticker   tags pop in, then drift
 *   data-count="400" data-prefix="$" data-suffix="ms"   number counts up when seen
 *   data-tilt           card tilts toward the pointer
 *   data-spotlight      a soft light follows the pointer across the element (CSS: .spotlight, --mx / --my)
 *   data-magnetic       element leans toward the pointer while it hovers
 */
export default function Fx({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const all = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));

      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        all("[data-anim=lines]").forEach((h) =>
          SplitText.create(h, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, { yPercent: 115, duration: 1.2, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: h, start: "top 88%" } }),
          }),
        );

        all("[data-anim=words]").forEach((p) =>
          SplitText.create(p, {
            type: "words",
            autoSplit: true,
            onSplit: (self) =>
              gsap.fromTo(
                self.words,
                { opacity: 0.16 },
                { opacity: 1, ease: "none", stagger: 0.06, scrollTrigger: { trigger: p, start: "top 82%", end: "bottom 48%", scrub: true } },
              ),
          }),
        );

        all("[data-anim=rise]").forEach((g) =>
          gsap.from(g.children, { y: 56, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.08, scrollTrigger: { trigger: g, start: "top 88%" } }),
        );

        all("[data-anim=stack]").forEach((g) =>
          gsap.from(g.children, { y: 12, opacity: 0, duration: 0.6, ease: "power2.out", stagger: 0.12, scrollTrigger: { trigger: g, start: "top 85%" } }),
        );

        all("[data-anim=hairline]").forEach((line) =>
          gsap.from(line, { scaleX: 0, transformOrigin: "left center", duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: line, start: "top 92%" } }),
        );

        all("[data-steps]").forEach((seq) => {
          // Step 1 lights, the rule to step 2 draws, step 2 lights, and so on.
          const tl = gsap.timeline({ scrollTrigger: { trigger: seq, start: "top 70%" } });
          const lines = seq.querySelectorAll("[data-steps-line]");
          seq.querySelectorAll("[data-step]").forEach((dot, i) => {
            tl.call(() => dot.setAttribute("data-lit", ""), [], ">");
            if (lines[i]) tl.from(lines[i], { scaleX: 0, transformOrigin: "left center", duration: 0.7, ease: "power2.inOut" }, ">+0.15");
          });
        });

        all("[data-draw]").forEach((path) => {
          const len = Number(path.getAttribute("pathLength")) || (path as unknown as SVGGeometryElement).getTotalLength(); // dashes are in pathLength units when it is set
          const to = Number(path.dataset.draw);
          gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: len * (1 - to), duration: 1.6, ease: "power3.out", scrollTrigger: { trigger: path, start: "top 88%" } });
        });

        all("[data-fill]").forEach((bar) =>
          gsap.from(bar, { scaleX: 0, transformOrigin: "left center", duration: 1.4, ease: "power3.out", delay: 0.2, scrollTrigger: { trigger: bar, start: "top 88%" } }),
        );

        all("[data-pop]").forEach((g) =>
          gsap.from(g.querySelectorAll("[data-pop-item]"), { scale: 0.3, opacity: 0, duration: 0.5, ease: "back.out(2.4)", stagger: 0.09, scrollTrigger: { trigger: g, start: "top 80%" } }),
        );

        all("[data-parallax]").forEach((img) =>
          gsap.fromTo(img, { yPercent: -10, scale: 1.08 }, { yPercent: 10, scale: 1.08, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } }),
        );

        const cloud = el.querySelector("[data-stickers]");
        const stickers = all("[data-sticker]");
        if (cloud && stickers.length) {
          gsap.from(stickers, {
            scale: 0,
            opacity: 0,
            rotation: () => gsap.utils.random(-40, 40),
            duration: 0.9,
            ease: "back.out(2.2)",
            stagger: { each: 0.06, from: "random" },
            scrollTrigger: { trigger: cloud, start: "top 72%" },
          });
          gsap.to(stickers, { y: (i) => (i % 2 ? -1 : 1) * 6, ease: "none", scrollTrigger: { trigger: cloud, start: "top bottom", end: "bottom top", scrub: 1 } });
        }

        all("[data-count]").forEach((n) => {
          const to = Number(n.dataset.count);
          const prefix = n.dataset.prefix ?? "";
          const suffix = n.dataset.suffix ?? "";
          const v = { n: 0 };
          gsap.to(v, { n: to, duration: 1.8, ease: "power2.out", scrollTrigger: { trigger: n, start: "top 90%" }, onUpdate: () => (n.textContent = `${prefix}${Math.round(v.n).toLocaleString("en-US")}${suffix}`) });
        });

        if (!matchMedia("(pointer: fine)").matches) return;
        // Pointer effects: each returns its cleanup.
        const on = (el: HTMLElement, move: (e: PointerEvent, r: DOMRect) => void, leave: () => void) => {
          const m = (e: PointerEvent) => move(e, el.getBoundingClientRect());
          el.addEventListener("pointermove", m);
          el.addEventListener("pointerleave", leave);
          return () => {
            el.removeEventListener("pointermove", m);
            el.removeEventListener("pointerleave", leave);
          };
        };
        const offs = [
          ...all("[data-tilt]").map((card) => {
            gsap.set(card, { transformPerspective: 1000 });
            const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3.out" });
            const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3.out" });
            return on(
              card,
              (e, r) => {
                rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
                ry(((e.clientX - r.left) / r.width - 0.5) * 8);
              },
              () => (rx(0), ry(0)),
            );
          }),
          ...all("[data-spotlight]").map((el) =>
            on(
              el,
              (e, r) => {
                el.style.setProperty("--mx", `${e.clientX - r.left}px`);
                el.style.setProperty("--my", `${e.clientY - r.top}px`);
              },
              () => {},
            ),
          ),
          ...all("[data-magnetic]").map((el) => {
            const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
            const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
            return on(
              el,
              (e, r) => {
                x((e.clientX - r.left - r.width / 2) * 0.25);
                y((e.clientY - r.top - r.height / 2) * 0.35);
              },
              () => (x(0), y(0)),
            );
          }),
        ];
        return () => offs.forEach((off) => off());
      });
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
