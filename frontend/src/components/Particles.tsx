import { useEffect, useRef } from "react";

interface Meteor {
  x: number;
  y: number;
  length: number;
  size: number;
  speed: number;
  angle: number; // in radians
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  delay: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
}

export default function Particles({ elevated = false }: { elevated?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let meteors: Meteor[] = [];
    let stars: Star[] = [];
    let lastBurstTime = 0;
    const BURST_INTERVAL_MS = 4000; // 4 seconds burst cycle
    let dpr = 1;

    const initStars = (width: number, height: number) => {
      stars = [];
      const starCount = Math.min(
        Math.floor((width * height) / 16000),
        85
      );
      const starColors = ["#ffffff", "#E5E4E2", "#F0F3F4", "#F5F7FA", "#E8ECEF"];

      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.1 + 0.5,
          baseAlpha: Math.random() * 0.45 + 0.3,
          twinkleSpeed: Math.random() * 0.003 + 0.0015,
          phase: Math.random() * Math.PI * 2,
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }
    };

    const resizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      initStars(w, h);
    };

    const createMeteor = (width: number, staggerDelay = 0): Meteor => {
      const spawnSide = Math.random() < 0.65;
      let startX: number;
      let startY: number;

      if (spawnSide) {
        startX = width * (0.35 + Math.random() * 0.75);
        startY = -60 - Math.random() * 180;
      } else {
        startX = Math.random() * width * 1.1;
        startY = -60 - Math.random() * 120;
      }

      const angleDeg = 138 + (Math.random() - 0.5) * 16;
      const angle = (angleDeg * Math.PI) / 180;

      const speed = Math.random() * 5 + 7;
      const length = Math.random() * 60 + 50;
      const size = Math.random() * 1.3 + 1.6;
      const maxAlpha = Math.random() * 0.25 + 0.75;
      const maxLife = Math.random() * 45 + 50;

      return {
        x: startX,
        y: startY,
        length,
        size,
        speed,
        angle,
        alpha: 0,
        maxAlpha,
        life: 0,
        maxLife,
        delay: staggerDelay,
      };
    };

    const spawnBurst = () => {
      const w = window.innerWidth;
      const count = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < count; i++) {
        const delay = Math.floor(Math.random() * 35);
        meteors.push(createMeteor(w, delay));
      }
    };

    resizeCanvas();
    spawnBurst();

    const animate = (timestamp: number) => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      // ── 1. FAST DYNAMIC STARRY NIGHT ──────────────────────────
      // Batch star rendering with alpha blending (zero expensive shadowBlur per frame)
      for (let j = 0; j < stars.length; j++) {
        const s = stars[j];
        const currentAlpha = Math.min(
          1,
          Math.max(0.15, s.baseAlpha + Math.sin(timestamp * s.twinkleSpeed + s.phase) * 0.3)
        );

        ctx.fillStyle = s.color;
        ctx.globalAlpha = currentAlpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Subtle bloom for largest twinkling stars
        if (s.size > 1.2 && currentAlpha > 0.6) {
          ctx.globalAlpha = currentAlpha * 0.25;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 2. PLATINUM METEOR SHOWER BURSTS ──────────────────
      if (timestamp - lastBurstTime > BURST_INTERVAL_MS) {
        spawnBurst();
        lastBurstTime = timestamp;
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];

        if (m.delay > 0) {
          m.delay--;
          continue;
        }

        m.life++;

        const dx = Math.cos(m.angle) * m.speed;
        const dy = Math.sin(m.angle) * m.speed;

        m.x += dx;
        m.y += dy;

        const fadeInRatio = 0.18;
        const fadeOutRatio = 0.32;
        const normalizedLife = m.life / m.maxLife;

        if (normalizedLife < fadeInRatio) {
          m.alpha = (normalizedLife / fadeInRatio) * m.maxAlpha;
        } else if (normalizedLife > 1 - fadeOutRatio) {
          const remaining = (1 - normalizedLife) / fadeOutRatio;
          m.alpha = Math.max(0, remaining * m.maxAlpha);
        } else {
          m.alpha = m.maxAlpha;
        }

        if (m.alpha > 0) {
          const tailX = m.x - Math.cos(m.angle) * m.length;
          const tailY = m.y - Math.sin(m.angle) * m.length;

          // Glowing trail gradient
          const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
          grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
          grad.addColorStop(0.2, `rgba(229, 228, 226, ${m.alpha * 0.85})`);
          grad.addColorStop(0.5, `rgba(47, 147, 173, ${m.alpha * 0.5})`);
          grad.addColorStop(1, `rgba(180, 195, 210, 0)`);

          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tailX, tailY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = m.size * 0.95;
          ctx.lineCap = "round";
          ctx.stroke();

          // Luminous meteor head with subtle glow
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(47, 147, 173, ${m.alpha * 0.35})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
          ctx.fill();

          ctx.restore();
        }

        if (
          m.life >= m.maxLife ||
          m.x < -120 ||
          m.y > h + 120
        ) {
          meteors.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resizeCanvas, { passive: true });
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 w-full h-full opacity-95 ${
        elevated ? "z-[110]" : "z-0"
      }`}
    />
  );
}

