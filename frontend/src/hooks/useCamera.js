import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera lifecycle for the photobooth.
 *
 * Contract:
 *   - The webcam stream is OFF on mount (`cameraOn === false`, `status === 'idle'`).
 *   - `startCamera()` flips it on; the <Webcam> only mounts while `cameraOn` is
 *     true, so getUserMedia is requested strictly on demand. If the user has
 *     already granted permission, the browser resolves it instantly.
 *   - `stopCamera()` stops every track and returns to the idle state.
 *   - On unmount, any live tracks are stopped — no leaked MediaStreams.
 */
export function useCamera() {
  const webcamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'requesting' | 'ready' | 'denied' | 'error'

  const startCamera = useCallback(() => {
    setStatus('requesting');
    setCameraOn(true);
  }, []);

  const handleUserMedia = useCallback(() => {
    setStatus('ready');
  }, []);

  const handleUserMediaError = useCallback((err) => {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      setStatus('denied');
    } else {
      setStatus('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = webcamRef.current?.video?.srcObject;
    stream?.getTracks?.().forEach((track) => track.stop());
    setCameraOn(false);
    setStatus('idle');
  }, []);

  // Hard guarantee: stop any live tracks if the booth unmounts.
  useEffect(() => {
    return () => {
      const stream = webcamRef.current?.video?.srcObject;
      stream?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  return {
    webcamRef,
    cameraOn,
    status,
    isReady: status === 'ready',
    startCamera,
    stopCamera,
    handleUserMedia,
    handleUserMediaError,
  };
}
