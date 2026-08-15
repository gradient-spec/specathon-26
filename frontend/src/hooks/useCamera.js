import { useCallback, useRef, useState } from 'react';

/**
 * Wraps a react-webcam instance and exposes clean status flags instead of
 * making every consumer poll the underlying <video> element.
 */
export function useCamera() {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState('requesting'); // 'requesting' | 'ready' | 'stopped' | 'denied' | 'error'

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
    setStatus('stopped');
  }, []);

  const restartCamera = useCallback(() => {
    setStatus('requesting');
  }, []);

  return {
    webcamRef,
    status,
    isReady: status === 'ready',
    handleUserMedia,
    handleUserMediaError,
    stopCamera,
    restartCamera,
  };
}
