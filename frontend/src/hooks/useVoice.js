import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Voice status values:
 *  'idle'        — nothing queued or playing
 *  'speaking'    — utterance is actively being spoken
 *  'paused'      — utterance was paused mid-speech
 *  'done'        — utterance finished naturally
 *  'unsupported' — browser has no SpeechSynthesis API
 */

const useVoice = () => {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [status, setStatus]     = useState(isSupported ? 'idle' : 'unsupported');
  const utteranceRef            = useRef(null);   // current SpeechSynthesisUtterance
  const textRef                 = useRef('');     // text of the current utterance (for repeat)
  const synthRef                = useRef(isSupported ? window.speechSynthesis : null);

  // -------------------------------------------------------------------------
  // Chrome bug workaround: speechSynthesis silently stops after ~15 s unless
  // you keep poking it.  We pause/resume every 10 s while speaking.
  // -------------------------------------------------------------------------
  const keepAliveRef = useRef(null);

  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    keepAliveRef.current = setInterval(() => {
      const synth = synthRef.current;
      if (synth && synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10_000);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Core speak function
  // -------------------------------------------------------------------------
  const speak = useCallback((text) => {
    if (!isSupported) return;

    const synth = synthRef.current;

    // Cancel anything currently playing
    synth.cancel();
    stopKeepAlive();

    if (!text?.trim()) return;

    textRef.current = text;

    const utterance = new SpeechSynthesisUtterance(text);

    // Prefer a natural English voice if one is available
    const voices = synth.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('natural') ||
          v.name.toLowerCase().includes('neural') ||
          v.name.toLowerCase().includes('google'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.rate  = 0.92;   // slightly slower than default — clearer for interview questions
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setStatus('speaking');
      startKeepAlive();
    };

    utterance.onpause = () => {
      setStatus('paused');
      stopKeepAlive();
    };

    utterance.onresume = () => {
      setStatus('speaking');
      startKeepAlive();
    };

    utterance.onend = () => {
      setStatus('done');
      stopKeepAlive();
    };

    utterance.onerror = (e) => {
      // 'interrupted' fires when we call cancel() intentionally — not a real error
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('[useVoice] SpeechSynthesis error:', e.error);
      setStatus('idle');
      stopKeepAlive();
    };

    utteranceRef.current = utterance;
    setStatus('speaking');

    // Chrome requires a tiny delay after cancel() before calling speak()
    setTimeout(() => synth.speak(utterance), 50);
  }, [isSupported, startKeepAlive, stopKeepAlive]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const pause = useCallback(() => {
    if (!isSupported) return;
    synthRef.current.pause();
    // onpause event will update status
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    synthRef.current.resume();
    // onresume event will update status
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    synthRef.current.cancel();
    stopKeepAlive();
    setStatus('idle');
  }, [isSupported, stopKeepAlive]);

  const repeat = useCallback(() => {
    if (!isSupported) return;
    speak(textRef.current);
  }, [isSupported, speak]);

  // -------------------------------------------------------------------------
  // Voices may load asynchronously (Chrome); re-trigger speak if needed
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupported) return;
    const synth = synthRef.current;
    const handler = () => {
      // Voices loaded — if we are currently speaking, re-pick voice
      if (utteranceRef.current && synth.speaking) {
        const voices = synth.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.toLowerCase().includes('natural') ||
              v.name.toLowerCase().includes('neural') ||
              v.name.toLowerCase().includes('google'))
        );
        if (preferred) utteranceRef.current.voice = preferred;
      }
    };
    synth.addEventListener('voiceschanged', handler);
    return () => synth.removeEventListener('voiceschanged', handler);
  }, [isSupported]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (isSupported) {
        synthRef.current.cancel();
        stopKeepAlive();
      }
    };
  }, [isSupported, stopKeepAlive]);

  const isSpeaking   = status === 'speaking';
  const isPaused     = status === 'paused';
  const isDone       = status === 'done';
  const isIdle       = status === 'idle';
  const isUnsupported = status === 'unsupported';

  // Answer textarea should be disabled until speech is done or paused/idle/done
  const answerEnabled = !isSpeaking;

  return {
    status,
    isSpeaking,
    isPaused,
    isDone,
    isIdle,
    isUnsupported,
    answerEnabled,
    speak,
    pause,
    resume,
    stop,
    repeat,
  };
};

export default useVoice;
