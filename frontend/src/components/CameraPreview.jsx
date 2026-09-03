import React from 'react';
import useCamera from '../hooks/useCamera';

// ---------------------------------------------------------------------------
// Icons (inline SVG — no extra dependencies)
// ---------------------------------------------------------------------------
const IconCamera = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
  </svg>
);

const IconCameraOff = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M9.172 9.172A4 4 0 0115 12m0 0a4 4 0 01-4 4M3 3l18 18M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 5H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-1" />
  </svg>
);

const IconMic = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
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
// Idle placeholder — shown before camera is started
// ---------------------------------------------------------------------------
const IdlePlaceholder = ({ onStart }) => (
  <div className="flex flex-col items-center justify-center gap-3 h-full py-8">
    <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
      <IconCamera className="w-7 h-7 text-purple-500 dark:text-purple-400" />
    </div>
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Interview Mode</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
      Enable your camera and microphone to simulate a real interview environment.
    </p>
    <button
      onClick={onStart}
      className="mt-1 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
    >
      <IconCamera className="w-4 h-4" />
      Enable Camera
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Requesting / loading state
// ---------------------------------------------------------------------------
const RequestingPlaceholder = () => (
  <div className="flex flex-col items-center justify-center gap-3 h-full py-8">
    <IconSpinner className="w-8 h-8 animate-spin text-purple-500" />
    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Requesting access…</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
      Allow camera and microphone access in the browser prompt.
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Error state — permission denied, device not found, etc.
// ---------------------------------------------------------------------------
const ErrorPlaceholder = ({ status, error, onRetry }) => {
  const isDenied = status === 'denied';
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full py-8 px-4">
      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
        <IconAlert className="w-7 h-7 text-red-500 dark:text-red-400" />
      </div>
      <p className="text-sm font-semibold text-red-700 dark:text-red-400 text-center">
        {isDenied ? 'Camera Access Denied' : 'Camera Unavailable'}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
        {error}
      </p>
      {isDenied && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Open <span className="font-semibold">browser settings → Site permissions</span> and allow camera access, then retry.
        </p>
      )}
      <button
        onClick={onRetry}
        className="mt-1 flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Off state — user manually turned off camera
// ---------------------------------------------------------------------------
const OffPlaceholder = ({ onStart }) => (
  <div className="flex flex-col items-center justify-center gap-3 h-full py-8">
    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <IconCameraOff className="w-7 h-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Camera is off</p>
    <button
      onClick={onStart}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
    >
      <IconCamera className="w-4 h-4" />
      Turn On
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Main CameraPreview component
// ---------------------------------------------------------------------------
const CameraPreview = () => {
  const { status, error, isActive, isLoading, hasError, startCamera, stopCamera, assignVideoRef } =
    useCamera();

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {/* Live indicator dot */}
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {isActive ? 'Camera Live' : 'Camera'}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
              <IconMic className="w-3 h-3" />
              Mic On
            </span>
          )}
        </div>

        {/* Toggle button */}
        {isActive && (
          <button
            onClick={stopCamera}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
          >
            <IconCameraOff className="w-3.5 h-3.5" />
            Turn Off
          </button>
        )}
      </div>

      {/* Video / placeholder area */}
      <div className="relative bg-gray-950 min-h-[200px]">
        {/* Live video feed — always in DOM so the ref is stable */}
        <video
          ref={assignVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full object-cover transition-opacity duration-300 ${
            isActive
              ? 'opacity-100 min-h-[200px]'
              : 'opacity-0 absolute inset-0 pointer-events-none h-0'
          }`}
        />

        {/* Overlaid state placeholders */}
        {!isActive && (
          <div className="w-full">
            {status === 'idle'       && <IdlePlaceholder onStart={startCamera} />}
            {isLoading               && <RequestingPlaceholder />}
            {hasError                && <ErrorPlaceholder status={status} error={error} onRetry={startCamera} />}
            {status === 'off'        && <OffPlaceholder onStart={startCamera} />}
          </div>
        )}

        {/* "LIVE" badge overlaid on active video */}
        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/40">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {isActive
            ? 'Your camera feed is only visible to you and is not recorded.'
            : 'Enable camera to simulate a real interview environment.'}
        </p>
      </div>
    </div>
  );
};

export default CameraPreview;
