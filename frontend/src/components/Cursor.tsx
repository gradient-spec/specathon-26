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

    document.body.classList.add("has-cursor");

    let mouseX = -100;
    let mouseY = -100;
    let currentX = -100;
    let currentY = -100;
    let hasMoved = false;

    let prevSpawnX = -100;
    let prevSpawnY = -100;

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
      if (particles.length > 40) return;

      const count = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const color = SILVER_PALETTE[Math.floor(Math.random() * SILVER_PALETTE.length)];
        particles.push({
          x: x + (Math.random() - 0.5) * 4,
          y: y + (Math.random() - 0.5) * 4,
          vx: -moveX * 0.1 + (Math.random() - 0.5) * 0.35,
          vy: -moveY * 0.1 + (Math.random() - 0.5) * 0.35 - 0.1,
          size: 1.2 + Math.random() * 1.8,
          alpha: 0.6 + Math.random() * 0.35,
          life: 0,
          maxLife: 18 + Math.floor(Math.random() * 14),
          color,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!hasMoved) {
        hasMoved = true;
        currentX = mouseX;
        currentY = mouseY;
        prevSpawnX = mouseX;
        prevSpawnY = mouseY;
        if (wrapRef.current) wrapRef.current.style.opacity = "1";
      }
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Efficient Event Delegation for hover state - NO MutationObserver needed!
    const INTERACTIVE_SELECTOR = "a, button, input, textarea, select, [data-cursor], [role='button'], label";

    const handlePointerOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_SELECTOR)) {
        dotRef.current?.classList.add("cursor-hover");
      }
    };

    const handlePointerOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_SELECTOR)) {
        dotRef.current?.classList.remove("cursor-hover");
      }
    };

    document.addEventListener("mouseover", handlePointerOver, { passive: true });
    document.addEventListener("mouseout", handlePointerOut, { passive: true });

    let animId: number;

    const render = () => {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      if (hasMoved) {
        const prevX = currentX;
        const prevY = currentY;

        // Ultra smooth easing
        currentX += (mouseX - currentX) * 0.32;
        currentY += (mouseY - currentY) * 0.32;

        if (wrapRef.current) {
          wrapRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }

        const dx = currentX - prevX;
        const dy = currentY - prevY;
        const dist = Math.hypot(currentX - prevSpawnX, currentY - prevSpawnY);

        if (dist > 4) {
          spawnDust(currentX, currentY, dx, dy);
          prevSpawnX = currentX;
          prevSpawnY = currentY;
        }
      }

      // Only draw and clear canvas if there are particles or just finished
      if (particles.length > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.92;
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
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      document.body.classList.remove("has-cursor");
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handlePointerOver);
      document.removeEventListener("mouseout", handlePointerOut);
      window.removeEventListener("resize", resizeCanvas);
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
        style={{ opacity: 0 }}
      >
        <div ref={dotRef} className="cursor-dot" />
      </div>
    </>
  );
}

