import { downloadDataUrl } from './downloadImage';
import { EVENT } from '../constants/event';

const FILENAME = 'specathon-2026-photo.png';

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * Tries the native Web Share API with the image file attached. Returns true
 * if the share sheet was actually shown (whether or not the user completed
 * or cancelled it) - false only when the API/file sharing isn't supported at
 * all, so the caller knows to fall back to download + a web share link.
 */
async function tryWebShare(dataUrl, text) {
  try {
    const file = await dataUrlToFile(dataUrl, FILENAME);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: EVENT.name, text });
      return true;
    }
  } catch (err) {
    // AbortError just means the user closed the native share sheet themselves.
    if (err?.name === 'AbortError') return true;
  }
  return false;
}

const shareText = `${EVENT.hashtag} ${EVENT.url}`;

/**
 * Instagram has no web share/API target, so the only honest flow is:
 * download the card, tell the person what just happened, then open
 * Instagram so they can attach it themselves.
 */
export async function shareToInstagram(dataUrl, { showToast }) {
  downloadDataUrl(dataUrl, FILENAME);
  showToast('Image downloaded. Opening Instagram...');
  window.setTimeout(() => {
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  }, 900);
}

export async function shareToLinkedIn(dataUrl, { showToast }) {
  if (await tryWebShare(dataUrl, shareText)) return;
  downloadDataUrl(dataUrl, FILENAME);
  showToast('Image downloaded. Opening LinkedIn...');
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(EVENT.url)}`;
  window.setTimeout(() => window.open(shareUrl, '_blank', 'noopener'), 900);
}

export async function shareToX(dataUrl, { showToast }) {
  if (await tryWebShare(dataUrl, shareText)) return;
  downloadDataUrl(dataUrl, FILENAME);
  showToast('Image downloaded. Opening X...');
  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(EVENT.hashtag)}&url=${encodeURIComponent(EVENT.url)}`;
  window.setTimeout(() => window.open(intentUrl, '_blank', 'noopener'), 900);
}

export async function shareToWhatsApp(dataUrl, { showToast }) {
  if (await tryWebShare(dataUrl, shareText)) return;
  downloadDataUrl(dataUrl, FILENAME);
  showToast('Image downloaded. Opening WhatsApp...');
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`Check out SPECATHON 2026! ${EVENT.url}`)}`;
  window.setTimeout(() => window.open(waUrl, '_blank', 'noopener'), 900);
}

export async function shareToTelegram(dataUrl, { showToast }) {
  if (await tryWebShare(dataUrl, shareText)) return;
  downloadDataUrl(dataUrl, FILENAME);
  showToast('Image downloaded. Opening Telegram...');
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(EVENT.url)}&text=${encodeURIComponent(EVENT.hashtag)}`;
  window.setTimeout(() => window.open(tgUrl, '_blank', 'noopener'), 900);
}

export async function copyEventLink(showToast) {
  try {
    await navigator.clipboard.writeText(EVENT.url);
    showToast('📋 Link Copied');
  } catch {
    showToast(`Copy this link: ${EVENT.url}`, 4500);
  }
}
