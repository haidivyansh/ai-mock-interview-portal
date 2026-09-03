import React from 'react';

// ---------------------------------------------------------------------------
// Inline SVG icons — zero extra dependencies
// ---------------------------------------------------------------------------
const IconPlay = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const IconPause = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const IconRepeat = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconStop = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h12v12H6z" />
  </svg>
);

const IconSpeaker = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3.5-3H5a1 1 0 01-1-1v-4a1 1 0 011-1h3.5L12 6z" />
  </svg>
);

const IconSpeakerOff = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Speaking animation — three bouncing bars
// ---------------------------------------------------------------------------
const SpeakingWave = () => (
  <span className="flex items-end gap-0.5 h-4" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1 rounded-full bg-purple-500 dark:bg-purple-400 animate-bounce"
        style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </span>
);

// ---------------------------------------------------------------------------
// Status label
// ---------------------------------------------------------------------------
const statusLabel = (status) => {
  switch (status) {
    case 'speaking': return 'AI is speaking…';
    case 'paused':   return 'Paused';
    case 'done':     return 'Done — you may answer';
    case 'idle':     return 'Press Play to hear the question';
    default:         return '';
  }
};

const statusColor = (status) => {
  switch (status) {
    case 'speaking': return 'text-purple-600 dark:text-purple-400';
    case 'paused':   return 'text-amber-500 dark:text-amber-400';
    case 'done':     return 'text-green-600 dark:text-green-400';
    default:         return 'text-gray-400 dark:text-gray-500';
  }
};

// ---------------------------------------------------------------------------
// Main VoiceControls component
//
// Props:
//   status        — from useVoice
//   isSpeaking    — boolean
//   isPaused      — boolean
//   isUnsupported — boolean
//   onPlay        — speak() from useVoice
//   onPause       — pause()
//   onResume      — resume()
//   onStop        — stop()
//   onRepeat      — repeat()
// ---------------------------------------------------------------------------
const VoiceControls = ({
  status,
  isSpeaking,
  isPaused,
  isUnsupported,
  onPlay,
  onPause,
  onResume,
  onStop,
  onRepeat,
}) => {
  // Browser unsupported — show a clear warning but don't break the layout
  if (isUnsupported) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <IconSpeakerOff className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
          Voice is not supported in this browser. Questions are displayed as text only.
        </p>
      </div>
    );
  }

  const isIdle = status === 'idle' || status === 'done';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isSpeaking ? (
          <SpeakingWave />
        ) : (
          <IconSpeaker className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className={`text-xs font-semibold truncate ${statusColor(status)}`}>
          {statusLabel(status)}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Control buttons */}
      <div className="flex items-center gap-1.5">

        {/* Play — shown when idle or done */}
        {isIdle && (
          <button
            onClick={onPlay}
            title="Play question"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <IconPlay className="w-3.5 h-3.5" />
            Play
          </button>
        )}

        {/* Pause — shown when speaking */}
        {isSpeaking && (
          <button
            onClick={onPause}
            title="Pause"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <IconPause className="w-3.5 h-3.5" />
            Pause
          </button>
        )}

        {/* Resume — shown when paused */}
        {isPaused && (
          <button
            onClick={onResume}
            title="Resume"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <IconPlay className="w-3.5 h-3.5" />
            Resume
          </button>
        )}

        {/* Stop — shown while speaking or paused */}
        {(isSpeaking || isPaused) && (
          <button
            onClick={onStop}
            title="Stop"
            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <IconStop className="w-3 h-3" />
            Stop
          </button>
        )}

        {/* Repeat — always available except when unsupported or speaking for the first time */}
        {(status === 'done' || status === 'paused' || status === 'idle') && (
          <button
            onClick={onRepeat}
            title="Repeat question"
            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <IconRepeat className="w-3.5 h-3.5" />
            Repeat
          </button>
        )}

      </div>
    </div>
  );
};

export default VoiceControls;
