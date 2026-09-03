import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * STT status values:
 *  'idle'        — not recording, no transcript yet
 *  'listening'   — actively capturing speech
 *  'done'        — stopped with a transcript ready
 *  'error'       — an error occurred (see errorType)
 *  'unsupported' — browser has no SpeechRecognition API
 */

// Resolve once at module load — stable reference, no recreation on render
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

const useSTT = () => {
  const isSupported = SpeechRecognitionAPI !== null;

  const [status, setStatus]               = useState(isSupported ? 'idle' : 'unsupported');
  const [errorType, setErrorType]         = useState(null);
  const [errorMsg, setErrorMsg]           = useState('');
  const [finalTranscript, setFinalTranscript]       = useState('');
  const [interimTranscript, setInterimTranscript]   = useState('');

  const recognitionRef   = useRef(null);
  const shouldRestartRef = useRef(false);  // true only while user wants continuous recording
  const autoStartTimerRef = useRef(null);  // holds the setTimeout for auto-start

  // -------------------------------------------------------------------------
  // Clear any pending auto-start timer
  // -------------------------------------------------------------------------
  const clearAutoStart = useCallback(() => {
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Tear down the current recognition instance cleanly
  // -------------------------------------------------------------------------
  const destroyRecognition = useCallback(() => {
    if (recognitionRef.current) {
      shouldRestartRef.current = false;
      recognitionRef.current.onstart  = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror  = null;
      recognitionRef.current.onend    = null;
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Create and wire a fresh SpeechRecognition instance
  // -------------------------------------------------------------------------
  const createRecognition = useCallback(() => {
    if (!isSupported) return null;

    const rec = new SpeechRecognitionAPI();
    rec.continuous      = false;  // single-shot mode — avoids the restart loop bug
    rec.interimResults  = true;
    rec.maxAlternatives = 1;
    rec.lang            = 'en-US';

    rec.onstart = () => {
      setStatus('listening');
      setErrorType(null);
      setErrorMsg('');
    };

    rec.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += text + ' ';
        } else {
          interim += text;
        }
      }
      if (finalChunk) {
        setFinalTranscript((prev) => (prev + finalChunk).trimStart());
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (event) => {
      // Suppress intentional aborts
      if (event.error === 'aborted' || event.error === 'interrupted') return;

      // For no-speech: just restart silently if the user still wants to record
      if (event.error === 'no-speech') {
        if (shouldRestartRef.current) {
          // Silently restart — don't show an error
          return;
        }
        // User stopped intentionally — treat as done
        setStatus('done');
        return;
      }

      let type = 'unknown';
      let msg  = 'Speech recognition failed. Please try again.';

      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          type = 'denied';
          msg  = 'Microphone permission was denied. Please allow mic access in browser settings.';
          break;
        case 'network':
          type = 'network';
          msg  = 'Network error during speech recognition. Check your connection and try again.';
          break;
        case 'audio-capture':
          type = 'denied';
          msg  = 'No microphone found. Please connect a microphone and try again.';
          break;
        case 'service-not-allowed':
          type = 'denied';
          msg  = 'Speech recognition service not allowed. Ensure you are using Chrome or Edge over HTTPS.';
          break;
        default:
          type = 'unknown';
          msg  = `Recognition error: ${event.error}`;
      }

      shouldRestartRef.current = false;
      setErrorType(type);
      setErrorMsg(msg);
      setStatus('error');
      setInterimTranscript('');
    };

    rec.onend = () => {
      setInterimTranscript('');

      // If user still wants to record, spin up a new instance and continue
      if (shouldRestartRef.current) {
        recognitionRef.current = null;
        const next = createRecognition();
        if (next) {
          recognitionRef.current = next;
          try { next.start(); } catch { /* ignore */ }
        }
        return;
      }

      setStatus((prev) => prev === 'error' ? prev : 'done');
    };

    return rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  // -------------------------------------------------------------------------
  // Start recording
  // -------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    if (!isSupported) return;

    clearAutoStart();
    destroyRecognition();

    setFinalTranscript('');
    setInterimTranscript('');
    setErrorType(null);
    setErrorMsg('');

    // Request microphone permission from the user-initiated Start button before
    // creating SpeechRecognition. This prevents browsers from rejecting an
    // otherwise opaque recognition request and surfaces a clear fallback path.
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorType('denied');
      setErrorMsg('This browser cannot access a microphone. Type your answer instead.');
      setStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      const isPermissionError = err.name === 'NotAllowedError' || err.name === 'SecurityError';
      const isDeviceError = err.name === 'NotFoundError' || err.name === 'NotReadableError';
      setErrorType(isPermissionError || isDeviceError ? 'denied' : 'unknown');
      setErrorMsg(
        isPermissionError
          ? 'Microphone permission was denied. Allow microphone access for localhost, then try again.'
          : isDeviceError
          ? 'No usable microphone was found. Connect a microphone or type your answer instead.'
          : `Could not access the microphone: ${err.message || 'unknown error'}`
      );
      setStatus('error');
      return;
    }

    shouldRestartRef.current = true;

    const rec = createRecognition();
    if (!rec) return;
    recognitionRef.current = rec;

    try {
      rec.start();
    } catch (err) {
      setErrorType('unknown');
      setErrorMsg('Could not start microphone: ' + err.message);
      setStatus('error');
      shouldRestartRef.current = false;
    }
  }, [isSupported, clearAutoStart, destroyRecognition, createRecognition]);

  // -------------------------------------------------------------------------
  // Stop recording
  // -------------------------------------------------------------------------
  const stopRecording = useCallback(() => {
    if (!isSupported) return;
    clearAutoStart();
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
    }
    setInterimTranscript('');
    setStatus('done');
  }, [isSupported, clearAutoStart]);

  // -------------------------------------------------------------------------
  // Reset — clear everything back to idle
  // -------------------------------------------------------------------------
  const reset = useCallback(() => {
    clearAutoStart();
    destroyRecognition();
    setFinalTranscript('');
    setInterimTranscript('');
    setErrorType(null);
    setErrorMsg('');
    setStatus(isSupported ? 'idle' : 'unsupported');
  }, [isSupported, clearAutoStart, destroyRecognition]);

  // -------------------------------------------------------------------------
  // Allow parent to directly set / edit the transcript
  // -------------------------------------------------------------------------
  const setTranscript = useCallback((text) => {
    setFinalTranscript(text);
    setInterimTranscript('');
  }, []);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      clearAutoStart();
      destroyRecognition();
    };
  }, [clearAutoStart, destroyRecognition]);

  const displayTranscript = finalTranscript + interimTranscript;
  const isListening   = status === 'listening';
  const isDone        = status === 'done';
  const isIdle        = status === 'idle';
  const hasError      = status === 'error';
  const isUnsupported = status === 'unsupported';

  return {
    status,
    errorType,
    errorMsg,
    finalTranscript,
    interimTranscript,
    displayTranscript,
    isListening,
    isDone,
    isIdle,
    hasError,
    isUnsupported,
    startRecording,
    stopRecording,
    reset,
    setTranscript,
    autoStartTimerRef,  // exposed so SpeechAnswerPanel can clear it on reset
  };
};

export default useSTT;
