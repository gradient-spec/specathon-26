import { useState } from 'react';
import { motion } from 'framer-motion';
import { PanelsTopLeft, Camera, RotateCcw, Download, Share2, Loader2, PowerOff } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

function TileButton({ icon: Icon, label, onClick, disabled, busy, accent = 'violet' }) {
  const [ripples, setRipples] = useState([]);
  const accentClasses =
    accent === 'violet'
      ? 'border-violet-glow/50 text-violet-glow hover:border-violet-glow/80'
      : 'border-cyan-glow/50 text-cyan-glow hover:border-cyan-glow/80';

  function handleClick(e) {
    if (disabled || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 500);
    onClick?.(e);
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      aria-label={label}
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      className={`
        relative overflow-hidden flex flex-col items-center justify-center gap-1
        w-[62px] h-[58px] sm:w-[74px] sm:h-[66px] rounded-xl border-[1.5px]
        bg-white/[0.03] backdrop-blur-md transition-colors duration-300 cursor-pointer
        disabled:opacity-30 disabled:cursor-not-allowed
        focus-visible:outline-none
        ${accentClasses}
      `}
    >
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ opacity: 0.35, scale: 0 }}
          animate={{ opacity: 0, scale: 3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute w-5 h-5 rounded-full bg-current pointer-events-none"
          style={{ left: r.x - 10, top: r.y - 10 }}
        />
      ))}
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      )}
      <span className="text-[10px] tracking-[0.1em] uppercase text-slate-300">{label}</span>
    </motion.button>
  );
}

/**
 * The four persistent controls beneath the polaroid: change frame,
 * capture/retake (toggles once a photo exists), download, and share.
 * Download/Share stay visible but disabled until there's a photo, matching
 * the reference layout instead of popping in and out.
 */
export default function ActionButtons({
  hasPhoto,
  cameraOn,
  cameraReady,
  onChangeFrame,
  onCapture,
  onTurnOff,
  onRetake,
  onDownload,
  onShare,
  isDownloading,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
      className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 w-full"
    >
      <TileButton icon={PanelsTopLeft} label="Frame" onClick={onChangeFrame} accent="violet" />
      {hasPhoto ? (
        <TileButton icon={RotateCcw} label="Retake" onClick={onRetake} accent="violet" />
      ) : (
        <>
          {/* Capture starts the camera on first tap, then snaps once the feed
              is live. Only disabled while the feed is spinning up. */}
          <TileButton
            icon={Camera}
            label="Capture"
            onClick={onCapture}
            disabled={cameraOn && !cameraReady}
            accent="violet"
          />
          {cameraOn && (
            <TileButton icon={PowerOff} label="Power Off" onClick={onTurnOff} accent="cyan" />
          )}
        </>
      )}
      <TileButton
        icon={Download}
        label="Download"
        onClick={onDownload}
        disabled={!hasPhoto}
        busy={isDownloading}
        accent="cyan"
      />
      <TileButton icon={Share2} label="Share" onClick={onShare} disabled={!hasPhoto} accent="cyan" />
    </motion.div>
  );
}
