import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Instagram, Linkedin, Twitter, MessageCircle, Send, Link2, Download, Loader2, X } from 'lucide-react';
import { generateBrandedCard, downloadDataUrl } from '../utils/downloadImage';
import {
  shareToInstagram,
  shareToLinkedIn,
  shareToX,
  shareToWhatsApp,
  shareToTelegram,
  copyEventLink,
} from '../utils/share';
import { useToast } from './Toast';

const EASE = [0.16, 1, 0.3, 1];

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, action: shareToInstagram },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, action: shareToLinkedIn },
  { key: 'x', label: 'X (Twitter)', icon: Twitter, action: shareToX },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, action: shareToWhatsApp },
  { key: 'telegram', label: 'Telegram', icon: Send, action: shareToTelegram },
];

/**
 * "Share your Hackathon Moment" sheet. The branded card is generated once
 * (lazily, on first action) and cached for the rest of the modal's session
 * so picking a second platform doesn't re-render the canvas from scratch.
 */
export default function ShareModal({ isOpen, onClose, photo, tagline, frame }) {
  const showToast = useToast();
  const [busyKey, setBusyKey] = useState(null);
  const cardCache = useRef(null);

  useEffect(() => {
    if (isOpen) {
      cardCache.current = null;
      showToast('🚀 Ready to Share');
    }
  }, [isOpen, showToast]);

  async function getCard() {
    if (cardCache.current) return cardCache.current;
    const card = await generateBrandedCard(photo, tagline, frame);
    cardCache.current = card;
    return card;
  }

  async function handlePlatform(platform) {
    if (busyKey) return;
    setBusyKey(platform.key);
    try {
      const card = await getCard();
      await platform.action(card, { showToast });
    } catch (err) {
      console.error(`[share] ${platform.key} failed:`, err);
      showToast('⚠️ Something went wrong - check the console');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCopyLink() {
    setBusyKey('copy');
    await copyEventLink(showToast);
    setBusyKey(null);
  }

  async function handleDownload() {
    setBusyKey('download');
    try {
      const card = await getCard();
      downloadDataUrl(card, 'specathon-2026-photo.png');
      showToast('✔ Image Downloaded');
    } catch (err) {
      console.error('[share modal] download failed:', err);
      showToast('⚠️ Download failed - check the console');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Share your hackathon moment"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.4, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[28px] glass-panel border border-white/[0.08] p-6 sm:p-7"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-base font-medium tracking-tight text-slate-100">
                Share your Hackathon Moment
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close share sheet"
                className="glass-button w-8 h-8 rounded-full flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              {PLATFORMS.map((platform, i) => (
                <motion.button
                  key={platform.key}
                  type="button"
                  onClick={() => handlePlatform(platform)}
                  disabled={Boolean(busyKey)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-2 py-3.5 rounded-2xl glass-button disabled:opacity-40"
                >
                  {busyKey === platform.key ? (
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.6} />
                  ) : (
                    <platform.icon className="w-5 h-5" strokeWidth={1.6} />
                  )}
                  <span className="text-[10.5px] tracking-wide text-slate-300">{platform.label}</span>
                </motion.button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={Boolean(busyKey)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl glass-button text-sm text-slate-200 disabled:opacity-40"
              >
                {busyKey === 'copy' ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Link2 className="w-4 h-4" strokeWidth={1.75} />
                )}
                Copy Link
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={Boolean(busyKey)}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-br from-indigo-glow to-violet-glow text-sm text-white disabled:opacity-40"
              >
                {busyKey === 'download' ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Download className="w-4 h-4" strokeWidth={1.75} />
                )}
                Download
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-500 text-center leading-relaxed">
              Instagram doesn't support direct sharing from the web - we'll download
              the image and open Instagram so you can post it yourself.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
