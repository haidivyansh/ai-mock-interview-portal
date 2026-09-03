import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Camera status values:
 *  'idle'        — camera not yet requested
 *  'requesting'  — waiting for browser permission prompt
 *  'active'      — stream is live
 *  'denied'      — user blocked camera / mic
 *  'unavailable' — no device found or hardware error
 *  'unsupported' — browser does not support getUserMedia
 *  'off'         — user turned camera off after it was active
 */

const useCamera = () => {
  const [status, setStatus]   = useState('idle');
  const [error, setError]     = useState('');
  const streamRef             = useRef(null);   // holds the MediaStream
  const videoRef              = useRef(null);   // attached to <video> element by consumer

  // ------------------------------------------------------------------
  // Start — request camera + microphone access
  // ------------------------------------------------------------------
  const startCamera = useCallback(async () => {
    // Guard: getUserMedia not available (e.g. non-HTTPS, old browser)
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Your browser does not support camera access. Try Chrome or Firefox over HTTPS.');
      return;
    }

    setStatus('requesting');
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });

      streamRef.current = stream;
      setStatus('active');

      // Attach stream to <video> element if it is already mounted
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      // Map DOMException names to friendly statuses
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError'
      ) {
        setStatus('denied');
        setError('Camera permission was denied. Please allow access in your browser settings and try again.');
      } else if (
        err.name === 'NotFoundError' ||
        err.name === 'DevicesNotFoundError'
      ) {
        setStatus('unavailable');
        setError('No camera or microphone found. Please connect a device and try again.');
      } else if (
        err.name === 'NotReadableError' ||
        err.name === 'TrackStartError'
      ) {
        setStatus('unavailable');
        setError('Camera is already in use by another application. Close it and try again.');
      } else if (err.name === 'OverconstrainedError') {
        setStatus('unavailable');
        setError('Camera does not meet the required constraints. Try a different camera.');
      } else {
        setStatus('unavailable');
        setError(`Could not access camera: ${err.message}`);
      }
    }
  }, []);

  // ------------------------------------------------------------------
  // Stop — release all tracks and clear the video element
  // ------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('off');
    setError('');
  }, []);

  // ------------------------------------------------------------------
  // When videoRef is attached after the stream is already active,
  // we need to assign srcObject manually. This effect runs whenever
  // the video element mounts (videoRef.current changes via callback ref).
  // ------------------------------------------------------------------
  const assignVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }, []);

  // ------------------------------------------------------------------
  // Cleanup on unmount — always stop the stream so the camera LED turns off
  // ------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const isActive     = status === 'active';
  const isLoading    = status === 'requesting';
  const hasError     = ['denied', 'unavailable', 'unsupported'].includes(status);

  return {
    status,
    error,
    isActive,
    isLoading,
    hasError,
    startCamera,
    stopCamera,
    assignVideoRef,   // use as <video ref={assignVideoRef} /> instead of useRef
  };
};

export default useCamera;
