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

export default function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let meteors: Meteor[] = [];
    let stars: Star[] = [];
    let lastBurstTime = 0;
    const BURST_INTERVAL_MS = 4000; // 4 seconds burst cycle

    const initStars = () => {
      stars = [];
      const starCount = Math.min(
        Math.floor((canvas.width * canvas.height) / 14000),
        95
      );
      const starColors = ["#ffffff", "#E5E4E2", "#F0F3F4", "#F5F7FA", "#E8ECEF"];

      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.1 + 0.5, // 0.5px - 1.6px
          baseAlpha: Math.random() * 0.45 + 0.3, // 0.3 - 0.75
          twinkleSpeed: Math.random() * 0.003 + 0.0015,
          phase: Math.random() * Math.PI * 2,
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const createMeteor = (staggerDelay = 0): Meteor => {
      // Spawn from top or upper-right area of screen
      const spawnSide = Math.random() < 0.65;
      let startX: number;
      let startY: number;

      if (spawnSide) {
        startX = canvas.width * (0.35 + Math.random() * 0.75);
        startY = -60 - Math.random() * 180;
      } else {
        startX = Math.random() * canvas.width * 1.1;
        startY = -60 - Math.random() * 120;
      }

      // Angle shooting down-left (approx 132° - 148°)
      const angleDeg = 138 + (Math.random() - 0.5) * 16;
      const angle = (angleDeg * Math.PI) / 180;

      const speed = Math.random() * 6 + 8; // speed 8px - 14px per frame
      const length = Math.random() * 65 + 50; // trail length 50px - 115px (vibrant & sleek)
      const size = Math.random() * 1.4 + 1.8; // head size 1.8px - 3.2px (bolder, crisp point)
      const maxAlpha = Math.random() * 0.25 + 0.75; // high opacity 0.75 - 1.0
      const maxLife = Math.random() * 45 + 55; // lifespan

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
      // Handful burst (3 to 6 meteors)
      const count = Math.floor(Math.random() * 4) + 3;
      for (let i = 0; i < count; i++) {
        const delay = Math.floor(Math.random() * 40);
        meteors.push(createMeteor(delay));
      }
    };

    resizeCanvas();
    spawnBurst();

    const animate = (timestamp: number) => {
      // Pause all rendering when tab is hidden to save CPU/GPU
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── 1. DYNAMIC STARRY NIGHT ──────────────────────────
      // Batch stars by shadow size to minimize GPU filter passes.
      // Draw large stars (shadowBlur=8) together, then small stars (shadowBlur=4).
      ctx.save();
      ctx.shadowBlur = 8;
      for (let j = 0; j < stars.length; j++) {
        const s = stars[j];
        if (s.size <= 1.6) continue;
        const currentAlpha = Math.min(
          1,
          Math.max(0.15, s.baseAlpha + Math.sin(timestamp * s.twinkleSpeed + s.phase) * 0.3)
        );
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = currentAlpha;
        ctx.shadowColor = s.color;
        ctx.fill();
      }
      ctx.shadowBlur = 4;
      for (let j = 0; j < stars.length; j++) {
        const s = stars[j];
        if (s.size > 1.6) continue;
        const currentAlpha = Math.min(
          1,
          Math.max(0.15, s.baseAlpha + Math.sin(timestamp * s.twinkleSpeed + s.phase) * 0.3)
        );
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = currentAlpha;
        ctx.shadowColor = s.color;
        ctx.fill();
      }
      ctx.restore();

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

        // Calculate trajectory vector
        const dx = Math.cos(m.angle) * m.speed;
        const dy = Math.sin(m.angle) * m.speed;

        m.x += dx;
        m.y += dy;

        // Fade in / out handling
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

        // Draw glowing smoke trail & platinum meteor head
        if (m.alpha > 0) {
          const tailX = m.x - Math.cos(m.angle) * m.length;
          const tailY = m.y - Math.sin(m.angle) * m.length;

          // Rich multi-stop gradient (Pure white head -> Platinum metallic -> Lumen teal accent -> Smoky silver)
          const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
          grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`); // Intense white core
          grad.addColorStop(0.2, `rgba(229, 228, 226, ${m.alpha * 0.85})`); // Platinum metallic
          grad.addColorStop(0.5, `rgba(47,147,173, ${m.alpha * 0.45})`); // Vibrant teal accent
          grad.addColorStop(1, `rgba(180, 195, 210, 0)`); // Translucent smoke tail

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tailX, tailY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = m.size * 0.95;
          ctx.lineCap = "round";
          ctx.shadowBlur = 14;
          ctx.shadowColor = "#2F93AD";
          ctx.stroke();

          // Platinum meteor head dot with vibrant bloom
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
          ctx.shadowBlur = 18;
          ctx.shadowColor = "#E5E4E2"; // Platinum glow
          ctx.fill();
          ctx.restore();
        }

        // Remove off-screen or expired meteors
        if (
          m.life >= m.maxLife ||
          m.x < -120 ||
          m.y > canvas.height + 120
        ) {
          meteors.splice(i, 1);
        }
      }

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
      className="pointer-events-none fixed inset-0 w-full h-full z-0 opacity-95"
    />
  );
}
