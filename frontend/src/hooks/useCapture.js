import { useCallback, useState } from 'react';

/**
 * Manages the capture / preview / retake lifecycle for the booth.
 * Keeps the webcam component itself dumb - all photo state lives here.
 */
export function useCapture(webcamRef) {
  const [photo, setPhoto] = useState(null); // data URL of the captured frame
  const [isFlashing, setIsFlashing] = useState(false);

  const capture = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) return null;

    // Brief flash gives physical "shutter" feedback before the preview swaps in.
    setIsFlashing(true);
    window.setTimeout(() => setIsFlashing(false), 220);
    setPhoto(shot);
    return shot;
  }, [webcamRef]);

  const retake = useCallback(() => {
    setPhoto(null);
  }, []);

  return { photo, isFlashing, capture, retake };
}
