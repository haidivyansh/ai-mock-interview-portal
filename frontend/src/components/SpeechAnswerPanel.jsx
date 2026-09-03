import React, { useState, useEffect } from "react";
import useSTT from '../hooks/useSTT';

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------
const IconMic = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
  </svg>
);

const IconMicOff = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

const IconStop = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h12v12H6z" />
  </svg>
);

const IconEdit = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconCheck = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

const IconAlert = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const IconSpinner = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Pulsing mic ring animation while listening
// ---------------------------------------------------------------------------
const MicIndicator = ({ isListening }) => (
  <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
    {isListening && (
      <>
        <span className="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-30 animate-ping" />
        <span className="absolute inline-flex w-10 h-10 rounded-full bg-red-400 opacity-20 animate-ping"
          style={{ animationDelay: '0.3s' }} />
      </>
    )}
    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
      isListening
        ? 'bg-red-500 shadow-lg shadow-red-500/40'
        : 'bg-gray-200 dark:bg-gray-700'
    }`}>
      {isListening
        ? <IconMic className="w-6 h-6 text-white" />
        : <IconMicOff className="w-6 h-6 text-gray-400 dark:text-gray-500" />
      }
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Unsupported banner
// ---------------------------------------------------------------------------
const UnsupportedBanner = () => (
  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20
    border border-amber-200 dark:border-amber-800 rounded-xl">
    <IconAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
        Voice recording not supported
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
        Your browser does not support SpeechRecognition. Use Chrome or Edge, or type your answer below.
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------
const ErrorBanner = ({ errorType, errorMsg, onRetry }) => {
  const isDenied = errorType === 'denied';
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20
      border border-red-200 dark:border-red-800 rounded-xl">
      <IconAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
          {isDenied ? 'Microphone access denied' : 'Recording error'}
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{errorMsg}</p>
        {isDenied && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            Open <span className="font-semibold">browser settings → Site permissions</span> and allow microphone access.
          </p>
        )}
      </div>
      {!isDenied && (
        <button onClick={onRetry}
          className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400
            hover:underline cursor-pointer">
          Retry
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main SpeechAnswerPanel
//
// Props:
//   voiceIsDone     — true when SpeechSynthesis finished reading the question
//   isSpeaking      — true while TTS is active (disables recording)
//   currentAnswer   — current stored answer string for this question
//   onAnswerChange  — (text) => void  — updates local answer state in parent
//   onSubmit        — async () => void — saves answer + advances question
//   isSubmitting    — bool — parent is saving to backend
//   questionIndex   — used to reset STT when question changes
// ---------------------------------------------------------------------------
const SpeechAnswerPanel = ({
  isSpeaking,
  currentAnswer,
  onAnswerChange,
  onSubmit,
  isSubmitting,
  questionIndex,
}) => {
  const {
    status,
    errorType,
    errorMsg,
    displayTranscript,
    interimTranscript,
    finalTranscript,
    isListening,
    isDone,
    isIdle,
    hasError,
    isUnsupported,
    startRecording,
    stopRecording,
    reset,
    setTranscript,
  } = useSTT();

  // true when user is editing the transcript manually
  const [isEditing, setIsEditing] = useState(false);

  // ── Reset STT + local edit state whenever question changes ──────────────
  useEffect(() => {
    reset();
    setIsEditing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex]);

  // ── Auto-start recording once TTS finishes reading the question ──────────
  // Guard: only fires once per question, not on every re-render
  useEffect(() => {
    if (hasError) setIsEditing(true);
  }, [hasError]);

  // ── Sync live transcript into parent answer state ────────────────────────
  useEffect(() => {
    if (displayTranscript) {
      onAnswerChange(displayTranscript);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTranscript]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStop = () => {
    stopRecording();
    setIsEditing(false);
  };

  const handleEditToggle = () => {
    if (!isEditing && isListening) stopRecording();
    setIsEditing((v) => !v);
  };

  const handleEditChange = (e) => {
    const val = e.target.value;
    setTranscript(val);
    onAnswerChange(val);
  };

  const handleRetry = () => {
    reset();
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (isListening) stopRecording();
    await onSubmit();
    reset();
    setIsEditing(false);
  };

  const canSubmit = currentAnswer.trim().length > 0 && !isSubmitting && !isSpeaking;
  const showTranscript = displayTranscript || currentAnswer;

  // ── Unsupported: fall back to plain textarea ─────────────────────────────
  if (isUnsupported) {
    return (
      <div className="space-y-3">
        <UnsupportedBanner />
        <textarea
          rows={6}
          value={currentAnswer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          disabled={isSpeaking}
          className={`w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 border
            border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white
            placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500
            focus:border-purple-500 resize-none transition
            ${isSpeaking ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
        <SubmitRow canSubmit={canSubmit} isSubmitting={isSubmitting} onSubmit={handleSubmit} />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Mic + status row ── */}
      <div className="flex items-center gap-4">
        <MicIndicator isListening={isListening} />

        <div className="flex-1 min-w-0">
          {/* Status label */}
          <p className={`text-sm font-semibold ${
            isListening ? 'text-red-500 dark:text-red-400' :
            isDone      ? 'text-green-600 dark:text-green-400' :
            hasError    ? 'text-red-600 dark:text-red-400' :
                          'text-gray-500 dark:text-gray-400'
          }`}>
            {isListening  && 'Listening… speak your answer'}
            {isDone       && 'Recording stopped'}
            {isIdle       && (isSpeaking ? 'Waiting for AI to finish…' : 'Press Start to record')}
            {hasError     && 'Recording error'}
          </p>

          {/* Live interim word — shows what's being heard right now */}
          {isListening && interimTranscript && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate italic">
              Hearing: "{interimTranscript}"
            </p>
          )}

          {/* Auto-started hint */}
          {isListening && !interimTranscript && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Microphone is open — talk now
            </p>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {(isIdle || isDone) && !isSpeaking && (
            <button onClick={startRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500
                hover:bg-red-600 text-white text-xs font-semibold rounded-xl
                transition cursor-pointer shadow-sm">
              <IconMic className="w-3.5 h-3.5" />
              {isDone ? 'Re-record' : 'Start'}
            </button>
          )}

          {isListening && (
            <button onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700
                hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500
                text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm">
              <IconStop className="w-3 h-3" />
              Stop
            </button>
          )}

          {(isDone || (isIdle && currentAnswer)) && (
            <button onClick={handleEditToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs
                font-semibold rounded-xl transition cursor-pointer ${
                isEditing
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20'
                  : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
              <IconEdit className="w-3.5 h-3.5" />
              {isEditing ? 'Done editing' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {hasError && (
        <ErrorBanner errorType={errorType} errorMsg={errorMsg} onRetry={handleRetry} />
      )}

      {/* ── Transcript display / edit area ── */}
      {(showTranscript || isEditing) && (
        <div className="relative">
          {isEditing ? (
            <textarea
              rows={6}
              value={currentAnswer}
              onChange={handleEditChange}
              autoFocus
              className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800
                border-2 border-purple-400 dark:border-purple-600 rounded-xl
                text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none
                focus:ring-2 focus:ring-purple-500 resize-none transition"
              placeholder="Edit your answer…"
            />
          ) : (
            <div className={`w-full min-h-[120px] px-4 py-3 text-sm rounded-xl
              border transition leading-relaxed whitespace-pre-wrap
              ${isListening
                ? 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-800 text-gray-900 dark:text-white'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
              }`}>
              {/* Final committed text */}
              <span>{finalTranscript}</span>
              {/* Live interim text in lighter colour */}
              {isListening && interimTranscript && (
                <span className="text-gray-400 dark:text-gray-500 italic">
                  {interimTranscript}
                </span>
              )}
            </div>
          )}

          {/* Character count */}
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 text-right">
            {currentAnswer.length} characters
          </p>
        </div>
      )}

      {/* ── No transcript yet — idle placeholder ── */}
      {!showTranscript && !isEditing && !hasError && (
        <div className="flex flex-col items-center justify-center py-8 border-2
          border-dashed border-gray-200 dark:border-gray-700 rounded-xl gap-2">
          <IconMic className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">
            {isSpeaking ? 'AI is reading the question…' : 'Your spoken answer will appear here'}
          </p>
          <p className="text-xs text-gray-300 dark:text-gray-600">
            Recording starts automatically after the question is read
          </p>
          {!isSpeaking && (
            <button
              type="button"
              onClick={() => {
                if (isListening) stopRecording();
                setIsEditing(true);
              }}
              className="mt-2 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/20 transition cursor-pointer"
            >
              Type your answer instead
            </button>
          )}
        </div>
      )}

      {/* ── Submit row ── */}
      <SubmitRow canSubmit={canSubmit} isSubmitting={isSubmitting} onSubmit={handleSubmit} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Submit row — extracted to avoid repetition
// ---------------------------------------------------------------------------
const SubmitRow = ({ canSubmit, isSubmitting, onSubmit }) => (
  <div className="flex items-center justify-between gap-3 pt-1">
    <p className="text-xs text-gray-400 dark:text-gray-500">
      {canSubmit
        ? 'Review your answer, then submit to move to the next question.'
        : 'Record or type your answer to enable submission.'}
    </p>
    <button
      onClick={onSubmit}
      disabled={!canSubmit}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700
        disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold
        rounded-xl shadow transition cursor-pointer shrink-0">
      {isSubmitting ? (
        <>
          <IconSpinner className="w-4 h-4 animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <IconCheck className="w-4 h-4" />
          Submit Answer
        </>
      )}
    </button>
  </div>
);

export default SpeechAnswerPanel;
