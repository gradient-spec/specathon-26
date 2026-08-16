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
    cameraOn,
    status: cameraStatus,
    isReady,
    handleUserMedia,
    handleUserMediaError,
    startCamera,
    stopCamera,
  } = useCamera();
  const { photo, isFlashing, capture, retake } = useCapture(webcamRef);

  const [isShareOpen, setShareOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Drives the after-capture sequence: flash -> freeze -> border glow +
  // particles -> "hell yeah!!" bounce -> controls reveal. `photo` itself is
  // set immediately (so the frame freezes right away); `justCaptured` and
  // `controlsReady` just choreograph what plays on top of that freeze.
  const [justCaptured, setJustCaptured] = useState(false);
  const [controlsReady, setControlsReady] = useState(true);

  const handleChangeFrame = useCallback(() => {
    setFrame((current) => {
      const next = FRAMES[(FRAMES.findIndex((item) => item.id === current.id) + 1) % FRAMES.length];
      return next;
    });
  }, []);

  const handleCapture = useCallback(() => {
    // First tap turns the camera ON (requests permission / activates feed).
    if (!cameraOn) {
      startCamera();
      return;
    }
    // Feed not live yet — wait for it.
    if (!isReady) return;

    // Feed is live: take the shot, then release the camera.
    const shot = capture();
    if (!shot) return;
    stopCamera();
    showToast('📸 Photo Captured');
    setControlsReady(false);
    setJustCaptured(true);
    window.setTimeout(() => setControlsReady(true), 650);
    window.setTimeout(() => setJustCaptured(false), 1300);
  }, [cameraOn, isReady, startCamera, capture, stopCamera, showToast]);

  const handleTurnOff = useCallback(() => {
    stopCamera();
  }, [stopCamera]);

  const handleRetake = useCallback(() => {
    // Clear the photo; camera stays off until the user taps Capture again.
    retake();
    stopCamera();
    setJustCaptured(false);
    setControlsReady(true);
  }, [retake, stopCamera]);

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
        cameraOn={cameraOn}
        cameraStatus={cameraStatus}
        photo={photo}
        isFlashing={isFlashing}
        justCaptured={justCaptured}
        frame={frame}
        handleUserMedia={handleUserMedia}
        handleUserMediaError={handleUserMediaError}
      />

      <ActionButtons
        hasPhoto={Boolean(photo) && controlsReady}
        cameraOn={cameraOn}
        cameraReady={isReady}
        onChangeFrame={handleChangeFrame}
        onCapture={handleCapture}
        onTurnOff={handleTurnOff}
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
