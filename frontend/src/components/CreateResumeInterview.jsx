import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const QUESTION_COUNTS = [3, 5, 7, 10];

const EXPERIENCE_LEVELS = [
  'Entry Level (0-2 yrs)',
  'Mid Level (2-5 yrs)',
  'Senior Level (5+ yrs)',
  'Lead / Manager',
];

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

const CreateResumeInterview = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile]                       = useState(null);
  const [numberOfQuestions, setNumQ]          = useState('5');
  const [jobRole, setJobRole]                 = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [difficulty, setDifficulty]           = useState('');
  const [uploading, setUploading]             = useState(false);
  const [uploadProgress, setUploadProgress]   = useState(0);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState('');
  const [processing, setProcessing]           = useState(false);

  // ── File validation ───────────────────────────────────────────────────────
  const validateFile = (f) => {
    const allowedMime = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const allowedExt = ['.pdf', '.docx'];
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();

    if (!allowedMime.includes(f.type) && !allowedExt.includes(ext)) {
      return 'Only PDF and DOCX files are supported.';
    }
    if (f.size > 5 * 1024 * 1024) return 'File size must be under 5 MB.';
    if (f.size === 0) return 'The selected file is empty.';
    return null;
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    setError('');
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.group('%c[Resume Upload] handleSubmit() triggered', 'color:#4f46e5;font-weight:bold');

    if (!file) {
      setError('Please upload your resume.');
      console.warn('[Resume Upload] Aborted — no file in state');
      console.groupEnd();
      return;
    }

    setUploading(true);
    setProcessing(false);
    setUploadProgress(0);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('numberOfQuestions', numberOfQuestions);
    if (jobRole.trim())         formData.append('jobRole', jobRole.trim());
    if (experienceLevel.trim()) formData.append('experienceLevel', experienceLevel);
    if (difficulty.trim())      formData.append('difficulty', difficulty);

    console.log('[Resume Upload] FormData entries:');
    for (const [k, v] of formData.entries()) {
      console.log(`[Resume Upload]   ${k} =`, typeof v === 'object' ? `[File name="${v.name}" size=${v.size}]` : v);
    }
    console.log('[Resume Upload] Auth header present?',
      api.defaults.headers.common?.Authorization
        ? `YES (${api.defaults.headers.common.Authorization.slice(0, 24)}…)`
        : 'NO — the /resume/create endpoint is protected, so this will 401');

    try {
      const { data, status, headers } = await api.post('/interview/resume/create', formData, {
        onUploadProgress: (evt) => {
          if (!evt || !evt.total || evt.total <= 0) return;
          const pct = Math.min(100, Math.max(0, Math.round((evt.loaded / evt.total) * 100)));
          setUploadProgress(pct);
          if (pct >= 100 && !processing) {
            console.log('[Resume Upload] Upload bytes done. Waiting for backend parsing + AI analysis...');
            setProcessing(true);
          }
        },
      });

      console.log(`[Resume Upload] RESPONSE HTTP ${status} — content-type: ${headers['content-type']}`);
      console.log('[Resume Upload] Response body:', data);

      if (!data?.interview) {
        throw new Error('Backend did not return an interview object. Check the server logs for details.');
      }
      if (!data.interview.id) {
        throw new Error('Backend returned interview object without an id field.');
      }

      console.log('[Resume Upload] Interview created:');
      console.log('[Resume Upload]   — id              =', data.interview.id);
      console.log('[Resume Upload]   — interviewType   =', data.interview.interviewType);
      console.log('[Resume Upload]   — question count  =', data.interview.questions?.length);
      console.log('[Resume Upload]   — generation seed =', data.interview.generation?.seed ?? '(n/a)');

      setUploadProgress(100);
      setSuccess(data.message || 'Resume uploaded successfully. Starting your interview…');
      setUploading(false);
      setProcessing(false);

      const targetUrl = `/interview/${data.interview.id}`;
      console.log(`[Resume Upload] ✅ SUCCESS — navigating to ${targetUrl}`);
      console.groupEnd();

      setTimeout(() => { navigate(targetUrl); }, 900);

    } catch (err) {
      setProcessing(false);
      setUploading(false);

      console.error('[Resume Upload] ❌ REQUEST FAILED');
      console.error('[Resume Upload]   name     =', err.name);
      console.error('[Resume Upload]   message  =', err.message);

      const statusCode = err.response?.status;
      const serverMsg  = err.response?.data?.message;

      console.error('[Resume Upload]   HTTP status =', statusCode ?? '(no response / network error)');
      if (serverMsg) {
        console.error('[Resume Upload]   server msg  =', serverMsg);
      }

      let friendly;
      if (statusCode === 0 || !err.response) {
        friendly = 'Network error — could not reach the backend. Check that the API server is running on port 5000.';
      } else if (statusCode === 401) {
        friendly = 'Your session has expired. Please log in again and retry.';
      } else if (statusCode === 422 && serverMsg && /scanned|image|text.*too.*short/i.test(serverMsg)) {
        friendly = serverMsg + ' Tip: Open the PDF, choose "File → Print → Save as PDF" to re-save it as a selectable text PDF, then re-upload. DOCX files are always text-based and work best.';
      } else if (statusCode === 422) {
        friendly = serverMsg || 'The uploaded file could not be parsed. It may be encrypted, password-protected, or corrupt.';
      } else if (statusCode === 400) {
        friendly = serverMsg || 'Invalid upload — the file was rejected. Check it is a PDF or DOCX under 5 MB.';
      } else {
        friendly = serverMsg || (err.message ? `Upload failed: ${err.message}` : 'Upload failed. Please try again.');
      }

      setError(friendly);
      console.groupEnd();
    }
  };

  const inputBase =
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 ' +
    'text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none ' +
    'focus:ring-2 transition duration-150 ' +
    'border-gray-300 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fadeIn">

      <div className="mb-8">
        <span className="px-3 py-1 text-xs font-semibold tracking-wider text-indigo-600
          uppercase bg-indigo-100 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
          Resume Mode
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Resume-Based Interview
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Upload your resume and AI will generate personalised interview questions
          based on your actual projects, skills and experience.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

        {success && (
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20
            border border-green-200 dark:border-green-800 rounded-xl text-sm
            text-green-700 dark:text-green-400 animate-fadeIn">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Resume uploaded successfully</p>
              <p className="mt-0.5 text-green-600/80 dark:text-green-400/80">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20
            border border-red-200 dark:border-red-800 rounded-xl text-sm
            text-red-700 dark:text-red-400 animate-fadeIn">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01M10.293 4.293a1 1 0 011.414 0L21 13.586V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-5.414z" />
            </svg>
            <div>
              <p className="font-semibold">Upload failed</p>
              <p className="mt-0.5 whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl transition cursor-pointer
            ${file
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-700'
              : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:border-indigo-400 dark:hover:border-indigo-600'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!file ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/40
                flex items-center justify-center">
                <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Drop your resume here or <span className="text-indigo-600 dark:text-indigo-400">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PDF or DOCX · Max 5 MB
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatSize(file.size)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                  Replace
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  className="text-xs font-semibold text-red-500 hover:underline cursor-pointer">
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>
                {processing
                  ? '✅ Upload complete — AI parsing your resume…'
                  : 'Uploading resume…'}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${
                processing ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-600'
              }`} style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {processing
                ? 'Analysing resume, extracting skills and generating personalised questions (10–20 seconds)…'
                : 'If your browser prompts for permission to upload, click Allow.'}
            </p>
          </div>
        )}

        <div className="h-px bg-gray-200 dark:bg-gray-800" />

        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Optional Interview Calibration
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-4">
            Provide these for even more tailored questions. If left blank, AI will infer the right level from your resume.
          </p>

          {/* Target Role */}
          <div>
            <label htmlFor="jobRole"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Target Job Role
            </label>
            <input
              id="jobRole"
              name="jobRole"
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g. Senior Java Backend Engineer, MERN Full-Stack Developer"
              className={inputBase}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Questions will be skewed towards this role even if your resume spans multiple technologies.
            </p>
          </div>

          {/* Experience Level */}
          <div>
            <label htmlFor="experienceLevel"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Target Experience Level
            </label>
            <select
              id="experienceLevel"
              name="experienceLevel"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className={inputBase}
            >
              <option value="">Auto-detect from resume</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Target Difficulty
            </span>
            <div className="flex gap-3" role="radiogroup" aria-label="Target Difficulty">
              {DIFFICULTY_LEVELS.map((level) => {
                const active = difficulty === level;
                const colorMap = {
                  Easy: active
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                  Medium: active
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                  Hard: active
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                };
                return (
                  <button key={level} type="button" role="radio" aria-checked={active}
                    onClick={() => setDifficulty(active ? '' : level)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition duration-150 cursor-pointer ${colorMap[level]}`}>
                    {level}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Number of questions */}
        <div>
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Number of Questions
          </span>
          <div className="flex gap-3 flex-wrap" role="radiogroup">
            {QUESTION_COUNTS.map((count) => {
              const selected = numberOfQuestions === String(count);
              return (
                <button key={count} type="button"
                  onClick={() => setNumQ(String(count))}
                  className={`w-16 py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl
              text-sm font-semibold text-gray-700 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={uploading || !file}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5
              bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
              disabled:cursor-not-allowed text-white rounded-xl text-sm
              font-semibold transition cursor-pointer">
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {processing ? 'Generating Interview…' : 'Uploading Resume…'}
              </>
            ) : (
              <>
                Start Resume Interview
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default CreateResumeInterview;
