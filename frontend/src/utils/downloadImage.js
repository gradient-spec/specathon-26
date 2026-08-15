import { CARD_WIDTH, CARD_HEIGHT } from '../constants/event';
import { DEFAULT_FRAME } from '../constants/frames';
import gradientMarkUrl from '../assets/gradient-mark-cutout.png';
import collegeCrestUrl from '../assets/college-crest-cutout.png';

import agLogoUrl from '../assets/domains/agriculture.png';
import aiLogoUrl from '../assets/domains/artificial-intelligence.png';
import blockchainLogoUrl from '../assets/domains/blockchain.png';
import securityLogoUrl from '../assets/domains/cyber-security.png';
import iotLogoUrl from '../assets/domains/iot.png';

import dataScienceLogoUrl from '../assets/domains/data-science.png';
import povertyLogoUrl from '../assets/domains/low poverty.png';
import innovationLogoUrl from '../assets/domains/open innovation.png';
import mobilityLogoUrl from '../assets/domains/self-driving-car.png';
import recycleLogoUrl from '../assets/domains/waste-management.png';
import { Bold } from 'lucide-react';

/**
 * Draws a rounded-rectangle path so we can clip / stroke / fill photo frames
 * and card backgrounds consistently.
 */
function roundedRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${String(src).slice(0, 80)}`));
    img.src = src;
  });
}

/**
 * Loads an optional decorative asset (a logo, the QR code). If it fails for
 * any reason - a bad path, an ad-blocker, whatever - we log it clearly and
 * return null instead of throwing, so the export still ships without that
 * one piece rather than failing completely and silently.
 */
async function loadOptional(label, promiseFactory) {
  try {
    return await promiseFactory();
  } catch (err) {
    console.error(`[branded card] ${label} failed to load, continuing without it:`, err);
    return null;
  }
}

/** Draws an image at a fixed height, preserving its native aspect ratio. */
function drawImageAtHeight(ctx, img, x, y, height, filter = 'none') {
  const width = (img.width / img.height) * height;
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();
  return width;
}

/** Scatters faint dots across the canvas so the paper doesn't read as a flat vector fill. */
function drawGrain(ctx, width, height, count = 2600) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.035)';
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawAiChip(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  roundedRectPath(ctx, x, y, size, size, 4);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `700 ${size * 0.34}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('AI', x + size / 2, y + size / 2 + size * 0.12);
  ctx.restore();
}

function drawDotGrid(ctx, x, y, color) {
  const scale = 2.5;
  ctx.save();
  ctx.fillStyle = color;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.beginPath();
      ctx.arc(x + col * 5 * scale, y + row * 5 * scale, 1.25 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawNetworkNode(ctx, x, y, color) {
  const scale = 2.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1 * scale;
  const pts = [
    [x, y],
    [x + 10 * scale, y - 7 * scale],
    [x + 10 * scale, y + 7 * scale],
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.stroke();
  pts.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLightningBolt(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.55, y);
  ctx.lineTo(x + size * 0.15, y + size * 0.55);
  ctx.lineTo(x + size * 0.42, y + size * 0.55);
  ctx.lineTo(x + size * 0.1, y + size);
  ctx.lineTo(x + size * 0.85, y + size * 0.4);
  ctx.lineTo(x + size * 0.55, y + size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Matches the four cyan camera brackets drawn over the live photo inset. */
function drawCornerBrackets(ctx, x, y, width, height) {
  const inset = 37;
  const length = 42;
  ctx.save();
  ctx.strokeStyle = '#00C2FF';
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const corners = [
    [x + inset, y + inset, 1, 1],
    [x + width - inset, y + inset, -1, 1],
    [x + inset, y + height - inset, 1, -1],
    [x + width - inset, y + height - inset, -1, -1],
  ];
  corners.forEach(([cx, cy, horizontal, vertical]) => {
    ctx.beginPath();
    ctx.moveTo(cx + horizontal * length, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + vertical * length);
    ctx.stroke();
  });
  ctx.restore();
}

/** The translucent strip that appears to pin the physical print in place. */
function drawTape(ctx) {
  const width = 240;
  const height = 64;
  const x = (CARD_WIDTH - width) / 2;
  const y = 8;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawGlobeIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
  ctx.restore();
}

function drawInstagramIcon(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  roundedRectPath(ctx, x - 8, y - 8, 16, 16, 4); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 4.5, y - 4.5, 1.1, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function drawLinkedInIcon(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = '700 18px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('in', x, y + 0.5);
  ctx.restore();
}

/** Same centred footer row as the live card: icon + handle, then separators. */
function drawFooter(ctx, y, color) {
  const font = '500 25px "Inter", sans-serif';
  const entries = [
    { label: 'gradientclub.in', icon: drawGlobeIcon },
    { label: '@gradientclub', icon: drawInstagramIcon },
    { label: 'The SPEC Gradient Club', icon: drawLinkedInIcon },
  ];
  ctx.save();
  ctx.font = font;
  const iconWidth = 22;
  const itemGap = 9;
  const separatorWidth = 26;
  const totalWidth = entries.reduce((sum, entry) => sum + iconWidth + itemGap + ctx.measureText(entry.label).width, 0)
    + separatorWidth * (entries.length - 1);
  let cursorX = (CARD_WIDTH - totalWidth) / 2;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  entries.forEach((entry, index) => {
    entry.icon(ctx, cursorX + 8, y - 1, color);
    cursorX += iconWidth + itemGap;
    ctx.textAlign = 'left';
    ctx.fillText(entry.label, cursorX, y);
    cursorX += ctx.measureText(entry.label).width;
    if (index < entries.length - 1) {
      cursorX += 13;
      ctx.textAlign = 'center';
      ctx.fillText('|', cursorX, y);
      cursorX += 13;
    }
  });
  ctx.restore();
}

/** The tech-motif column running down each side of the paper margins. */
function drawSideDecorations(ctx, photoX, top, span, frame, leftLogos = [], rightLogos = []) {
  const { motifIndigo: indigo, motifViolet: violet, motifCyan: cyan } = frame;
  ctx.textBaseline = 'middle';

  // Centered neatly between outer boundary and photo inset border
  const leftX = photoX - 37;
  const rightX = CARD_WIDTH - photoX + 37;

  const isDomainFrame = ['burgundy', 'slate', 'gold'].includes(frame.id);

  // =====================================================================
  // MANUAL POSITIONS TABLE — Must match PolaroidDecorations.jsx exactly!
  // If you change positions in PolaroidDecorations.jsx, copy the same
  // values here so the downloaded image matches the live preview.
  // =====================================================================
  const MANUAL_POSITIONS = {
    left: [
      { top: 10, x: -1, rot: -4 },   // Element 1 (topmost)
      { top: 28, x: -2, rot: 10 },   // Element 2
      { top: 50, x: -1, rot: -10 },   // Element 3 (middle)
      { top: 70, x: -2, rot: -15 },   // Element 4
      { top: 90, x: 1, rot: 20 },   // Element 5 (bottommost)
    ],
    right: [
      { top: 9, x: 2, rot: 20 },   // Element 1 (topmost)
      { top: 28, x: 2, rot: -20 },   // Element 2
      { top: 50, x: 3, rot: 20 },   // Element 3 (middle)
      { top: 70, x: 0, rot: 0 },   // Element 4
      { top: 88, x: 3, rot: 20 },   // Element 5 (bottommost)
    ],
  };

  const getManualOffsets = (isLeft, index) => {
    const pos = isLeft ? MANUAL_POSITIONS.left[index] : MANUAL_POSITIONS.right[index];
    return {
      topPercent: pos.top,
      x: pos.x,
      rot: pos.rot
    };
  };

  if (isDomainFrame && leftLogos.length === 5 && rightLogos.length === 5) {
    const logoSize = 50;

    for (let index = 0; index < 5; index++) {
      const leftLogoImg = leftLogos[index];
      const rightLogoImg = rightLogos[index];

      // Draw Left Side Logo
      if (leftLogoImg) {
        const layout = getManualOffsets(true, index);
        const y = top + span * (layout.topPercent / 100);
        const canvasX = leftX + layout.x * 3.0857; // scale factor

        ctx.save();
        ctx.translate(canvasX, y);
        ctx.rotate(layout.rot * Math.PI / 180);
        ctx.filter = frame.logoFilter || 'none';
        ctx.globalAlpha = 0.9;
        ctx.drawImage(leftLogoImg, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
        ctx.restore();
      }

      // Draw Right Side Logo
      if (rightLogoImg) {
        const layout = getManualOffsets(false, index);
        const y = top + span * (layout.topPercent / 100);
        const canvasX = rightX + layout.x * 3.0857;

        ctx.save();
        ctx.translate(canvasX, y);
        ctx.rotate(layout.rot * Math.PI / 180);
        ctx.filter = frame.logoFilter || 'none';
        ctx.globalAlpha = 0.9;
        ctx.drawImage(rightLogoImg, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
        ctx.restore();
      }
    }
  } else {
    // 5 Standard Tech Elements for Classic and Midnight
    let leftStandard = [
      { draw: (x, y) => { ctx.textAlign = 'center'; ctx.fillStyle = indigo; ctx.font = '700 26px "JetBrains Mono", monospace'; ctx.fillText('</>', x, y); } },
      { draw: (x, y) => drawAiChip(ctx, x - 18, y - 18, 36, indigo) },
      { draw: (x, y) => drawNetworkNode(ctx, x - 12, y, cyan) },
      { draw: (x, y) => { ctx.save(); ctx.strokeStyle = indigo; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } },
      { draw: (x, y) => drawLightningBolt(ctx, x - 16, y - 16, 32, violet) },
    ];

    let rightStandard = [
      { draw: (x, y) => { ctx.textAlign = 'center'; ctx.fillStyle = cyan; ctx.font = '600 20px "JetBrains Mono", monospace'; ctx.fillText('0101', x, y - 10); ctx.fillText('1010', x, y + 12); } },
      { draw: (x, y) => { ctx.textAlign = 'center'; ctx.fillStyle = violet; ctx.font = '700 26px "JetBrains Mono", monospace'; ctx.fillText('{ }', x, y); } },
      { draw: (x, y) => { ctx.save(); ctx.strokeStyle = cyan; ctx.lineWidth = 2.2; roundedRectPath(ctx, x - 14, y - 12, 28, 24, 4); ctx.stroke(); ctx.restore(); } },
      { draw: (x, y) => drawNetworkNode(ctx, x - 12, y, indigo) },
      { draw: (x, y) => { ctx.save(); ctx.strokeStyle = cyan; ctx.lineWidth = 2.2; ctx.strokeRect(x - 12, y - 12, 24, 24); ctx.restore(); } },
    ];

    if (frame.id === 'midnight') {
      leftStandard = [
        { draw: (x, y) => drawNetworkNode(ctx, x - 12, y, cyan) },
        { draw: (x, y) => { ctx.textAlign = 'center'; ctx.fillStyle = indigo; ctx.font = '700 26px "JetBrains Mono", monospace'; ctx.fillText('</>', x, y); } },
        { draw: (x, y) => drawLightningBolt(ctx, x - 16, y - 16, 32, violet) },
        { draw: (x, y) => drawAiChip(ctx, x - 18, y - 18, 36, indigo) },
        { draw: (x, y) => { ctx.save(); ctx.strokeStyle = indigo; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } },
      ];
      rightStandard = [
        { draw: (x, y) => { ctx.save(); ctx.strokeStyle = cyan; ctx.lineWidth = 2.2; ctx.strokeRect(x - 12, y - 12, 24, 24); ctx.restore(); } },
        { draw: (x, y) => { ctx.textAlign = 'center'; ctx.fillStyle = violet; ctx.font = '700 26px "JetBrains Mono", monospace'; ctx.fillText('{ }', x, y); } },
        { draw: (x, y) => drawNetworkNode(ctx, x - 12, y, indigo) },
        { draw: (x, y) => { ctx.textAlign = 'center'; ctx.fillStyle = cyan; ctx.font = '600 20px "JetBrains Mono", monospace'; ctx.fillText('0101', x, y - 10); ctx.fillText('1010', x, y + 12); } },
        { draw: (x, y) => { ctx.save(); ctx.strokeStyle = cyan; ctx.lineWidth = 2.2; roundedRectPath(ctx, x - 14, y - 12, 28, 24, 4); ctx.stroke(); ctx.restore(); } },
      ];
    }

    // Draw Left Standard Items
    leftStandard.forEach((item, index) => {
      const layout = getManualOffsets(true, index);
      const y = top + span * (layout.topPercent / 100);
      const canvasX = leftX + layout.x * 3.0857;

      ctx.save();
      ctx.translate(canvasX, y);
      ctx.rotate(layout.rot * Math.PI / 180);
      item.draw(0, 0);
      ctx.restore();
    });

    // Draw Right Standard Items
    rightStandard.forEach((item, index) => {
      const layout = getManualOffsets(false, index);
      const y = top + span * (layout.topPercent / 100);
      const canvasX = rightX + layout.x * 3.0857;

      ctx.save();
      ctx.translate(canvasX, y);
      ctx.rotate(layout.rot * Math.PI / 180);
      item.draw(0, 0);
      ctx.restore();
    });
  }
}

/**
 * Renders the captured photo into the same tall Polaroid layout displayed in
 * the live booth: logo row, photo inset, cyan camera brackets, captions, and
 * footer. The download deliberately contains no extra QR or social-card UI.
 * Returns a PNG data URL.
 */
export async function generateBrandedCard(photoDataUrl, tagline, frame = DEFAULT_FRAME) {
  // Fonts must be fully loaded before we draw text into the canvas, otherwise the
  // browser silently falls back to default serif/sans-serif.
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('600 35px "JetBrains Mono"'),
        document.fonts.load('800 86px "Playfair Display"'),
        document.fonts.load('700 31px "JetBrains Mono"'),
        document.fonts.load('500 25px Inter'),
        document.fonts.ready,
      ]);
    } catch (err) {
      console.warn('[branded card] Font loading promise warning:', err);
    }
  }

  // The captured photo is required - if this fails, the export genuinely
  // can't proceed, so it's allowed to throw. Everything else (logos) is
  // decorative: each loads independently and degrades to "skip it" on
  // failure instead of taking the whole export down with it.
  // The captured photo is required - if this fails, the export genuinely
  // can't proceed, so it's allowed to throw. Everything else (logos) is
  // decorative: each loads independently and degrades to "skip it" on
  // failure instead of taking the whole export down with it.
  const img = await loadImage(photoDataUrl);
  const isDomainFrame = ['burgundy', 'slate', 'gold'].includes(frame.id);
  const [
    collegeCrest, gradientMark,
    agLogo, aiLogo, blockchainLogo, securityLogo, iotLogo,
    dataScienceLogo, povertyLogo, innovationLogo, mobilityLogo, recycleLogo
  ] = await Promise.all([
    loadOptional("St. Peter's College crest", () => loadImage(collegeCrestUrl)),
    loadOptional('Gradient Club mark', () => loadImage(gradientMarkUrl)),
    isDomainFrame ? loadOptional('AgriTech logo', () => loadImage(agLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('AI logo', () => loadImage(aiLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('Web3 logo', () => loadImage(blockchainLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('CyberSec logo', () => loadImage(securityLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('IoT logo', () => loadImage(iotLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('DataScience logo', () => loadImage(dataScienceLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('Poverty logo', () => loadImage(povertyLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('Innovation logo', () => loadImage(innovationLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('Mobility logo', () => loadImage(mobilityLogoUrl)) : Promise.resolve(null),
    isDomainFrame ? loadOptional('Recycle logo', () => loadImage(recycleLogoUrl)) : Promise.resolve(null),
  ]);

  let leftLogos = [];
  let rightLogos = [];

  if (isDomainFrame) {
    const leftSet = [agLogo, aiLogo, blockchainLogo, securityLogo, iotLogo];
    const rightSet = [dataScienceLogo, povertyLogo, innovationLogo, mobilityLogo, recycleLogo];

    leftLogos = [...leftSet];
    rightLogos = [...rightSet];

    // Mirroring the exact shuffling patterns in PolaroidDecorations.jsx per frame
    if (frame.id === 'slate') {
      leftLogos = [blockchainLogo, agLogo, iotLogo, securityLogo, aiLogo];
      rightLogos = [innovationLogo, mobilityLogo, dataScienceLogo, recycleLogo, povertyLogo];
    } else if (frame.id === 'gold') {
      leftLogos = [securityLogo, blockchainLogo, aiLogo, iotLogo, agLogo];
      rightLogos = [recycleLogo, innovationLogo, povertyLogo, dataScienceLogo, mobilityLogo];
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');

  // --- Outer background (to avoid transparent checkered corners in download) ---
  ctx.fillStyle = '#0B0C0E'; // matches the app's premium dark background
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // --- Paper background ---
  // The download matches the live card's rounded corners (cardRadius = 74).
  // To avoid any transparent outline antialiasing artifact, we draw a rounded rectangle path fill directly.
  const cardRadius = 74;
  ctx.save();
  ctx.fillStyle = frame.paper;
  ctx.beginPath();
  roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, cardRadius);
  ctx.fill();

  // Clip only for the grain to keep it inside the rounded card boundaries
  ctx.save();
  ctx.beginPath();
  roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, cardRadius);
  ctx.clip();
  drawGrain(ctx, CARD_WIDTH, CARD_HEIGHT);
  ctx.restore();
  ctx.restore();
  // (Tape is omitted from the downloaded image per user's request)

  // --- Geometry ---
  const outerX = 49;
  const photoX = 81;
  const logoY = 49;
  const logoHeight = 99;
  const photoY = 172;
  const photoWidth = CARD_WIDTH - photoX * 2;
  const photoHeight = photoWidth * 1.25;
  const photoBottom = photoY + photoHeight;
  const radius = 25;

  // --- Logos ---
  if (collegeCrest) {
    drawImageAtHeight(ctx, collegeCrest, outerX, logoY, logoHeight, frame.logoFilter);
  }
  if (gradientMark) {
    const gradientMarkWidth = (gradientMark.width / gradientMark.height) * logoHeight;
    drawImageAtHeight(ctx, gradientMark, CARD_WIDTH - outerX - gradientMarkWidth, logoY, logoHeight, frame.logoFilter);
  }

  // --- Side tech-motif columns (HIDDEN for testing) ---
  // drawSideDecorations(ctx, photoX, photoY, photoHeight, frame, leftLogos, rightLogos);

  // --- Photo inset, with the same portrait 4:5 ratio as the live booth ---
  ctx.save();
  roundedRectPath(ctx, photoX, photoY, photoWidth, photoHeight, radius);
  ctx.clip();

  const imgRatio = img.width / img.height;
  const frameRatio = photoWidth / photoHeight;
  let drawW, drawH, drawX, drawY;
  if (imgRatio > frameRatio) {
    drawH = photoHeight;
    drawW = photoHeight * imgRatio;
    drawX = photoX - (drawW - photoWidth) / 2;
    drawY = photoY;
  } else {
    drawW = photoWidth;
    drawH = photoWidth / imgRatio;
    drawX = photoX;
    drawY = photoY - (drawH - photoHeight) / 2;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();

  // Lens shade gradient overlay over photo inset
  const photoShade = ctx.createLinearGradient(0, photoY, 0, photoBottom);
  photoShade.addColorStop(0, 'rgba(0,0,0,0.45)');
  photoShade.addColorStop(0.45, 'rgba(0,0,0,0.05)');
  photoShade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = photoShade;
  roundedRectPath(ctx, photoX, photoY, photoWidth, photoHeight, radius);
  ctx.fill();
  drawCornerBrackets(ctx, photoX, photoY, photoWidth, photoHeight);

  // --- Caption hierarchy: "See you at" -> "SPECATHON-2026" -> "#UnleashYourCreativity" ---
  // Exact 1:1 math & fonts matching CameraCard.jsx
  let cursorY = photoBottom + 79;

  ctx.textAlign = 'center';
  ctx.fillStyle = frame.mutedInk;
  ctx.font = '600 35px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('See you at', CARD_WIDTH / 2, cursorY);

  cursorY += 73;
  ctx.fillStyle = frame.ink;
  ctx.font = '800 86px "Playfair Display", serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPECATHON-2026', CARD_WIDTH / 2, cursorY);

  cursorY += 71;
  ctx.fillStyle = frame.hashtagColor || '#000000';
  ctx.font = '700 31px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('#UnleashYourCreativity', CARD_WIDTH / 2, cursorY);

  // --- Footer: one centred social row ---
  cursorY += 89;
  drawFooter(ctx, cursorY, frame.mutedInk);

  return canvas.toDataURL('image/png', 1);
}

/** Triggers a browser download for a data URL without navigating the page. */
export function downloadDataUrl(dataUrl, filename = 'specathon-2026-photo.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
