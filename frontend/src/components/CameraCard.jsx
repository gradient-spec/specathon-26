import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { CameraOff, Globe, Instagram, Linkedin } from 'lucide-react';
import PolaroidDecorations from './PolaroidDecorations';
import { DEFAULT_FRAME } from '../constants/frames';
import gradientMarkUrl from '../assets/gradient-mark-cutout.png';
import collegeCrestUrl from '../assets/college-crest-cutout.png';

const VIDEO_CONSTRAINTS = {
  width: 1080,
  height: 1080,
  facingMode: 'user',
};

const EASE = [0.16, 1, 0.3, 1];
const CARD_TILT = 0;

const PARTICLE_ANGLES = [20, 65, 110, 155, 200, 245, 290, 335];

const SOCIALS = [
  { icon: Globe, label: 'gradientclub.in' },
  { icon: Instagram, label: '@gradientclub' },
  { icon: Linkedin, label: 'The SPEC Gradient Club' },
];

function CornerBracket({ style: extraStyle, className }) {
  return (
    <span
      className={`absolute w-5 h-5 ${className}`}
      style={{ borderColor: 'rgba(0,194,255,0.6)', ...extraStyle }}
    />
  );
}

/**
 * A real-polaroid-styled hero: authentic proportions (thin top/side border,
 * a deep caption strip at the bottom, a portrait photo), straight physical alignment,
 * tape and grain for texture, and the event's tags/social handles printed on the paper below.
 */
export default function CameraCard({
  webcamRef,
  webcamKey,
  cameraActive,
  cameraStatus,
  handleUserMedia,
  handleUserMediaError,
  photo,
  isFlashing,
  justCaptured,
  frame,
}) {
  const safeFrame = frame || DEFAULT_FRAME;
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: px * 4, y: py * 4 });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotate: CARD_TILT }}
      animate={{ opacity: 1, y: 0, rotate: CARD_TILT, scale: justCaptured ? 1.006 : 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative w-[260px] rounded-[20px] px-2.5 pt-2.5 pb-3 transition-colors duration-500 flex-shrink-0 mx-auto"
      style={{
        backgroundColor: safeFrame.paper,
        color: safeFrame.ink,
        boxShadow:
          '0 30px 60px -20px rgba(0,0,0,0.6), 0 10px 24px -12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      <div className="grain-overlay rounded-[24px]" />

      {/* A clean strip of tape pinning the print down */}
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-7 bg-white/50 border border-white/70 backdrop-blur-[1px] shadow-sm"
        style={{ transform: 'translateX(-50%)' }}
      />

      {/* Logos - printed on the paper, top of the card */}
      <div className="relative z-10 flex items-center justify-between mb-2 px-1 pt-1">
        <img
          src={collegeCrestUrl}
          alt="St. Peter's Engineering College"
          className="h-6 w-auto object-contain transition-all duration-300"
          style={{
            filter: safeFrame.logoFilter || 'none',
            mixBlendMode: safeFrame.isDark ? 'screen' : 'multiply',
            opacity: safeFrame.isDark ? 0.95 : 0.85,
          }}
        />
        <img
          src={gradientMarkUrl}
          alt="Gradient Technical Club"
          className="h-6 w-auto object-contain transition-all duration-300"
          style={{
            filter: safeFrame.logoFilter || 'none',
            mixBlendMode: safeFrame.isDark ? 'screen' : 'multiply',
            opacity: safeFrame.isDark ? 0.95 : 0.85,
          }}
        />
      </div>

      {/* Photo inset - portrait frame */}
      <div className="relative z-10 mx-auto" style={{ width: '86%' }}>
        <PolaroidDecorations frame={safeFrame} />
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setParallax({ x: 0, y: 0 })}
          style={{ aspectRatio: '4/5', minHeight: '200px', borderRadius: '6px', overflow: 'hidden', position: 'relative', backgroundColor: '#0B0F14', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)' }}
        >
          <motion.div
            className="absolute inset-0"
            animate={{ x: parallax.x, y: parallax.y }}
            transition={{ type: 'spring', stiffness: 90, damping: 22 }}
          >
            {photo ? (
              <img
                src={photo}
                alt="Your captured hackathon moment"
                className="w-full h-full object-cover scale-[1.03]"
              />
            ) : !cameraActive ? (
              // Camera not started yet — show idle placeholder, no permission asked
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
                <span style={{ fontSize: '2rem' }}>📸</span>
                <p className="text-xs leading-relaxed" style={{ color: 'white', opacity: 0.8 }}>Click <strong>Capture</strong> to open camera</p>
              </div>
            ) : cameraStatus === 'denied' || cameraStatus === 'error' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 px-8 text-center">
                <CameraOff className="w-8 h-8" strokeWidth={1.5} />
                <p className="text-sm">
                  {cameraStatus === 'denied'
                    ? 'Camera access was denied. Allow camera permission in your browser to continue.'
                    : "Couldn't reach a camera on this device."}
                </p>
              </div>
            ) : (
              <Webcam
                key={webcamKey}
                ref={webcamRef}
                audio={false}
                mirrored
                screenshotFormat="image/jpeg"
                screenshotQuality={0.92}
                videoConstraints={VIDEO_CONSTRAINTS}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                className="w-full h-full object-cover scale-[1.03]"
              />
            )}
          </motion.div>

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/35" />

          <CornerBracket className="top-3 left-3 border-t-2 border-l-2 rounded-tl-md" />
          <CornerBracket className="top-3 right-3 border-t-2 border-r-2 rounded-tr-md" />
          <CornerBracket className="bottom-3 left-3 border-b-2 border-l-2 rounded-bl-md" />
          <CornerBracket className="bottom-3 right-3 border-b-2 border-r-2 rounded-br-md" />

          <AnimatePresence>
            {!photo && cameraStatus === 'ready' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-black/35 backdrop-blur-md"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-dot" />
                <span className="font-mono text-[9.5px] tracking-[0.15em] text-white/80">LIVE</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isFlashing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute inset-0 bg-white"
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {justCaptured && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {PARTICLE_ANGLES.map((angle, i) => {
                  const rad = (angle * Math.PI) / 180;
                  const distance = 90 + (i % 3) * 18;
                  return (
                    <motion.span
                      key={angle}
                      initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
                      animate={{
                        opacity: 0,
                        x: Math.cos(rad) * distance,
                        y: Math.sin(rad) * distance,
                        scale: 0.3,
                      }}
                      transition={{ duration: 0.7, ease: EASE, delay: i * 0.02 }}
                      className="absolute w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#00C2FF' }}
                    />
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Printed caption block */}
      <div className="relative z-20 flex flex-col items-center pt-1">
        <p className="mt-2 font-mono text-[9px] font-semibold tracking-wider text-center" style={{ color: safeFrame.mutedInk }}>
          See you at
        </p>
        <p className="mt-0.5 font-playfair text-lg font-bold tracking-tight text-center" style={{ color: safeFrame.ink }}>
          SPECATHON-2026
        </p>
        <p className="mt-0.5 font-mono text-[8px] font-bold tracking-[0.12em] text-center" style={{ color: safeFrame.hashtagColor || '#000000' }}>
          #UnleashYourCreativity
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 px-1">
          {SOCIALS.map((s, index) => (
            <span key={s.label} className="flex items-center gap-1 text-[7px] font-medium whitespace-nowrap" style={{ color: safeFrame.mutedInk }}>
              {index > 0 && <span aria-hidden="true" style={{ opacity: 0.4 }} className="mx-0.5">|</span>}
              <span className="flex items-center gap-0.5">
                <s.icon className="w-1.6 h-1.6 shrink-0" strokeWidth={1.75} />
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
