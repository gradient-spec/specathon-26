import { useCallback, useRef, useState } from 'react';

/**
 * Wraps a react-webcam instance and exposes clean status flags.
 *
 * Key design decision: the camera does NOT auto-start on mount.
 * `active` starts false — the Webcam component is not rendered until
 * the user explicitly clicks Capture. This means no permission prompt
 * on page load. Permission is requested only when the user wants it.
 */
export function useCamera() {
  const webcamRef = useRef(null);

  // Whether the <Webcam> component should be in the DOM at all
  const [active, setActive] = useState(false);

  // 'idle' | 'requesting' | 'ready' | 'stopped' | 'denied' | 'error'
  const [status, setStatus] = useState('idle');

  const startCamera = useCallback(() => {
    setStatus('requesting');
    setActive(true);
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
    setActive(false);
  }, []);

  const stopCamera = useCallback(() => {
    const stream = webcamRef.current?.video?.srcObject;
    stream?.getTracks?.().forEach((track) => track.stop());
    setStatus('stopped');
    setActive(false);
  }, []);

  const restartCamera = useCallback(() => {
    setStatus('requesting');
    setActive(true);
  }, []);

  return {
    webcamRef,
    active,         // controls whether <Webcam> is in the DOM
    status,
    isReady: status === 'ready',
    startCamera,
    handleUserMedia,
    handleUserMediaError,
    stopCamera,
    restartCamera,
  };
}
