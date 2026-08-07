import { useState, useCallback } from 'react';
import CameraCard from './CameraCard';
import ActionButtons from './ActionButtons';
import ShareModal from './ShareModal';
import { useCamera } from '../hooks/useCamera';
import { useCapture } from '../hooks/useCapture';
import { generateBrandedCard, downloadDataUrl } from '../utils/downloadImage';
import { useToast } from './Toast';
import { DEFAULT_FRAME, FRAMES } from '../constants/frames';

export default function PhotoBooth() {
  const showToast = useToast();

  const [tagline] = useState('');
  const [frame, setFrame] = useState(DEFAULT_FRAME);

  const {
    webcamRef,
    status: cameraStatus,
    isReady,
    handleUserMedia,
    handleUserMediaError,
    stopCamera,
    restartCamera,
  } = useCamera();
  const { photo, isFlashing, capture, retake } = useCapture(webcamRef);

  const [isShareOpen, setShareOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [justCaptured, setJustCaptured] = useState(false);

  const handleChangeFrame = useCallback(() => {
    setFrame((current) => {
      const next = FRAMES[(FRAMES.findIndex((item) => item.id === current.id) + 1) % FRAMES.length];
      return next;
    });
  }, []);

  const handleCapture = useCallback(() => {
    const shot = capture();
    if (!shot) return;
    stopCamera();
    showToast('📸 Photo Captured');
    setJustCaptured(true);
    window.setTimeout(() => setJustCaptured(false), 1300);
  }, [capture, stopCamera, showToast]);

  const handleRetake = useCallback(() => {
    retake();
    restartCamera();
    setJustCaptured(false);
  }, [retake, restartCamera]);

  const handleDownload = useCallback(async () => {
    if (!photo) return;
    setIsDownloading(true);
    try {
      const card = await generateBrandedCard(photo, tagline, frame);
      downloadDataUrl(card, 'specathon-2026-photo.png');
      showToast('✔ Image Downloaded');
    } catch (err) {
      console.error('[download] failed to generate branded card:', err);
      showToast('⚠️ Download failed - check the console for details');
    } finally {
      setIsDownloading(false);
    }
  }, [photo, tagline, frame, showToast]);

  return (
    <div className="w-full flex flex-col items-center gap-8">
      <CameraCard
        tagline={tagline}
        webcamRef={webcamRef}
        cameraStatus={cameraStatus}
        photo={photo}
        isFlashing={isFlashing}
        justCaptured={justCaptured}
        frame={frame}
        handleUserMedia={handleUserMedia}
        handleUserMediaError={handleUserMediaError}
      />

      <ActionButtons
        hasPhoto={Boolean(photo)}
        cameraReady={isReady}
        onChangeFrame={handleChangeFrame}
        onCapture={handleCapture}
        onRetake={handleRetake}
        onDownload={handleDownload}
        onShare={() => setShareOpen(true)}
        isDownloading={isDownloading}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setShareOpen(false)}
        photo={photo}
        tagline={tagline}
        frame={frame}
      />
    </div>
  );
}
