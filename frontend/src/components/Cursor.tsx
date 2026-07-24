import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

const SILVER_PALETTE = [
  "#ffffff",
  "#f8fafc",
  "#e2e8f0",
  "#cbd5e1",
  "#94a3b8",
];

export default function Cursor() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;

    let prevSpawnX = mouseX;
    let prevSpawnY = mouseY;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    const particles: Particle[] = [];

    const spawnDust = (x: number, y: number, moveX: number, moveY: number) => {
      if (particles.length > 50) return;

      const count = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const color = SILVER_PALETTE[Math.floor(Math.random() * SILVER_PALETTE.length)];
        // Spawn dust at silver globe position, drifting slightly backward from globe motion vector
        particles.push({
          x: x + (Math.random() - 0.5) * 4,
          y: y + (Math.random() - 0.5) * 4,
          vx: -moveX * 0.12 + (Math.random() - 0.5) * 0.4,
          vy: -moveY * 0.12 + (Math.random() - 0.5) * 0.4 - 0.1,
          size: 1.2 + Math.random() * 2.0,
          alpha: 0.6 + Math.random() * 0.35,
          life: 0,
          maxLife: 20 + Math.floor(Math.random() * 16),
          color,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });

    const interactive = document.querySelectorAll("a, button, input, textarea, select, [data-cursor]");
    const grow = () => dotRef.current?.classList.add("cursor-hover");
    const shrink = () => dotRef.current?.classList.remove("cursor-hover");

    const attachCursor = (root: Document | Element) => {
      const els = root.querySelectorAll("a, button, input, textarea, select, [data-cursor]");
      els.forEach((el) => {
        el.removeEventListener("mouseenter", grow);
        el.removeEventListener("mouseleave", shrink);
        el.addEventListener("mouseenter", grow);
        el.addEventListener("mouseleave", shrink);
      });
    };

    attachCursor(document);

    // Re-attach when new DOM nodes are added (lazy-loaded sections)
    const observer = new MutationObserver(() => attachCursor(document));
    observer.observe(document.body, { childList: true, subtree: true });

    let animId: number;

    const render = () => {
      // Pause cursor animation when tab is hidden
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      const prevX = currentX;
      const prevY = currentY;

      // Custom silver globe lerps smoothly behind user's physical mouse pointer
      currentX += (mouseX - currentX) * 0.32;
      currentY += (mouseY - currentY) * 0.32;

      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }

      const dx = currentX - prevX;
      const dy = currentY - prevY;
      const dist = Math.hypot(currentX - prevSpawnX, currentY - prevSpawnY);

      // Spawn dust ONLY from the silver globe position as it moves
      if (dist > 4) {
        spawnDust(currentX, currentY, dx, dy);
        prevSpawnX = currentX;
        prevSpawnY = currentY;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92; // gradual slowdown behind cursor
        p.vy *= 0.92;
        p.life++;

        const lifeRatio = p.life / p.maxLife;
        const currentAlpha = p.alpha * (1 - lifeRatio);
        const currentSize = p.size * (1 - lifeRatio * 0.5);

        if (p.life >= p.maxLife || currentAlpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, currentAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resizeCanvas);
      observer.disconnect();
      const all = document.querySelectorAll("a, button, input, textarea, select, [data-cursor]");
      all.forEach((el) => {
        el.removeEventListener("mouseenter", grow);
        el.removeEventListener("mouseleave", shrink);
      });
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[9998] hidden md:block"
      />
      <div
        ref={wrapRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] will-change-transform hidden md:block"
      >
        <div ref={dotRef} className="cursor-dot" />
      </div>
    </>
  );
}
