import { useState } from 'react';
import { motion } from 'framer-motion';
import { PanelsTopLeft, Camera, RotateCcw, Download, Share2, Loader2, VideoOff } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

function TileButton({ icon: Icon, label, onClick, disabled, busy, accent = 'violet' }) {
  const [ripples, setRipples] = useState([]);

  const accentColor = accent === 'violet' ? '#7C3AED' : '#00C2FF';

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
      className="relative overflow-hidden flex flex-col items-center justify-center gap-2 w-[88px] h-[72px] sm:w-[96px] sm:h-[76px] rounded-2xl border-[1.5px] bg-white/[0.04] backdrop-blur-md transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none"
      style={{
        borderColor: `${accentColor}80`,
        color: accentColor,
      }}
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
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.75} />
      ) : (
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      )}
      <span className="text-[10px] tracking-[0.1em] uppercase" style={{ color: 'rgb(203 213 225)' }}>{label}</span>
    </motion.button>
  );
}

/**
 * The four persistent controls beneath the polaroid: change frame,
 * capture/retake (toggles once a photo exists), download, and share.
 * Download/Share stay visible but disabled until there's a photo.
 */
export default function ActionButtons({
  hasPhoto,
  cameraActive,
  onChangeFrame,
  onCapture,
  onRetake,
  onStopCamera,
  onDownload,
  onShare,
  isDownloading,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
      className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap"
    >
      {/* Frame — always enabled */}
      <TileButton
        icon={PanelsTopLeft}
        label="Frame"
        onClick={onChangeFrame}
        accent="violet"
      />

      {/* Capture / Retake — always enabled; handler shows toast if no permission */}
      {hasPhoto ? (
        <TileButton
          icon={RotateCcw}
          label="Retake"
          onClick={onRetake}
          accent="violet"
        />
      ) : (
        <TileButton
          icon={Camera}
          label="Capture"
          onClick={onCapture}
          accent="violet"
        />
      )}

      {/* Stop Camera — only shown while camera is live and no photo taken yet */}
      {cameraActive && !hasPhoto && (
        <TileButton
          icon={VideoOff}
          label="Stop"
          onClick={onStopCamera}
          accent="violet"
        />
      )}

      {/* Download — enabled once photo exists */}
      <TileButton
        icon={Download}
        label="Download"
        onClick={onDownload}
        disabled={!hasPhoto}
        busy={isDownloading}
        accent="cyan"
      />

      {/* Share — enabled once photo exists */}
      <TileButton
        icon={Share2}
        label="Share"
        onClick={onShare}
        disabled={!hasPhoto}
        accent="cyan"
      />
    </motion.div>
  );
}
