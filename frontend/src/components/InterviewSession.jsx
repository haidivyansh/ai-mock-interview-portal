import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import CameraPreview from './CameraPreview';
import VoiceControls from './VoiceControls';
import SpeechAnswerPanel from './SpeechAnswerPanel';
import FeedbackCard, { FeedbackCardSkeleton } from './FeedbackCard';
import useVoice from '../hooks/useVoice';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SECONDS_PER_QUESTION = 300; // 5 minutes per question

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const timerColor = (seconds) => {
  if (seconds > 120) return 'text-purple-600 dark:text-purple-400';
  if (seconds > 60)  return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Top progress bar + question counter */
const ProgressBar = ({ current, total }) => {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span>Question {current + 1} of {total}</span>
        <span>{pct}% complete</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/** Countdown timer badge */
const TimerBadge = ({ seconds }) => (
  <div
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 font-mono text-sm font-bold transition-colors ${timerColor(seconds)}`}
  >
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {formatTime(seconds)}
  </div>
);

/** Difficulty badge */
const DifficultyBadge = ({ difficulty }) => {
  const map = {
    Easy:   'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800',
    Hard:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800',
  };
  if (!difficulty) return null;
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${map[difficulty] ?? map.Medium}`}>
      {difficulty}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------
const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
      Loading your interview session...
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Results / Summary screen — fetches Gemini evaluation for each answer
// ---------------------------------------------------------------------------
const ResultsScreen = ({ questions, answers, interviewMeta, interviewId, navigate }) => {
  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;
  const skippedCount  = questions.length - answeredCount;

  // feedbacks[idx] = null (loading) | { score, technicalAccuracy, communication, suggestions, correctAnswer } | 'error'
  const [feedbacks, setFeedbacks]       = useState({});
  const [evaluating, setEvaluating]     = useState(false);
  const [evalStarted, setEvalStarted]   = useState(false);
  const [overallScore, setOverallScore] = useState(null);

  const evaluateAll = useCallback(async () => {
    if (evalStarted) return;
    setEvalStarted(true);
    setEvaluating(true);

    const answered = questions
      .map((q, idx) => ({ q, idx, answer: answers[idx] || '' }))
      .filter(({ answer }) => answer.trim());

    // Build the interview context block once so every inline evaluation call gets the full picture
    const evaluationContext = interviewMeta && {
      jobRole:         interviewMeta.jobRole,
      skills:          interviewMeta.skills || [],
      experienceLevel: interviewMeta.experienceLevel || '',
      difficulty:      interviewMeta.difficulty || '',
    };

    // Mark all answered questions as loading
    const initial = {};
    answered.forEach(({ idx }) => { initial[idx] = null; });
    setFeedbacks(initial);

    const scores = [];

    // Evaluate sequentially to avoid rate-limit bursts
    for (const { q, idx, answer } of answered) {
      try {
        const { data } = await api.post('/interview/evaluate-inline', {
          question:    q.question,
          answerText:  answer,
          interviewId: interviewId || undefined,
          questionId:  q.id ?? idx + 1,
          context:     evaluationContext || undefined,
        });
        setFeedbacks((prev) => ({ ...prev, [idx]: data.feedback }));
        const overall = data.feedback.overallScore ?? data.feedback.score;
        if (typeof overall === 'number') scores.push(overall);
      } catch {
        setFeedbacks((prev) => ({ ...prev, [idx]: 'error' }));
      }
    }

    if (scores.length > 0) {
      setOverallScore(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
    }
    setEvaluating(false);
  }, [questions, answers, interviewId, evalStarted, interviewMeta]);

  // Auto-trigger evaluation as soon as the screen mounts
  useEffect(() => {
    evaluateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoreColor = (s) =>
    s >= 8 ? 'text-green-600 dark:text-green-400' :
    s >= 5 ? 'text-amber-500 dark:text-amber-400' :
             'text-red-500 dark:text-red-400';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 animate-fadeIn">

      {/* ── Hero card ── */}
      <div className="p-8 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900
        dark:border-gray-800 shadow-sm text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full
          bg-purple-100 dark:bg-purple-950/50 mx-auto">
          <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">
          Interview Complete!
        </h2>

        {interviewMeta && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">
              {interviewMeta.jobRole}
            </span>
            {interviewMeta.interviewType !== 'resume' && interviewMeta.interviewType !== 'hr' && interviewMeta.difficulty && (
              <>
                {' · '}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  interviewMeta.difficulty === 'Easy'
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
                    : interviewMeta.difficulty === 'Hard'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800'
                }`}>{interviewMeta.difficulty}</span>
              </>
            )}
            {interviewMeta.interviewType === 'resume' && (
              <>
                {' · '}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800">
                  Resume Interview
                </span>
              </>
            )}
            {interviewMeta.interviewType === 'hr' && (
              <>
                {' · '}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800">
                  HR Interview
                </span>
              </>
            )}
            {interviewMeta.interviewType !== 'resume' && interviewMeta.interviewType !== 'hr' && interviewMeta.experienceLevel && (
              <>{' · '}{interviewMeta.experienceLevel}</>
            )}
          </p>
        )}

        {/* Stats row */}
        <div className="flex justify-center gap-6 pt-2 text-sm">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-purple-600">{answeredCount}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">Answered</p>
          </div>
          <div className="w-px bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-gray-400">{skippedCount}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">Skipped</p>
          </div>
          <div className="w-px bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            {overallScore !== null ? (
              <p className={`text-2xl font-extrabold ${scoreColor(overallScore)}`}>
                {overallScore}/10
              </p>
            ) : evaluating ? (
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            ) : (
              <p className="text-2xl font-extrabold text-gray-400">—</p>
            )}
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">AI Score</p>
          </div>
        </div>

        {/* Evaluating banner */}
        {evaluating && (
          <div className="flex items-center justify-center gap-2 text-xs font-medium
            text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20
            border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Gemini AI is evaluating your answers…
          </div>
        )}

        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white
            text-sm font-semibold rounded-xl shadow transition cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>

      {/* ── Per-question feedback ── */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white px-1">AI Evaluation</h3>
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const answer   = answers[idx] || '';
          const feedback = feedbacks[idx];

          // Skipped question
          if (!answer.trim()) {
            return (
              <div key={q.id ?? idx}
                className="p-5 bg-white border border-gray-200 rounded-2xl
                  dark:bg-gray-900 dark:border-gray-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-600 bg-purple-50
                    dark:bg-purple-950/30 px-2.5 py-0.5 rounded-full border
                    border-purple-200 dark:border-purple-800">Q{idx + 1}</span>
                  <span className="ml-auto text-xs font-semibold text-amber-500
                    bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full">
                    Skipped
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {q.question}
                </p>
              </div>
            );
          }

          // Still loading
          if (feedback === null || feedback === undefined) {
            return <FeedbackCardSkeleton key={q.id ?? idx} index={idx} />;
          }

          // Evaluation error
          if (feedback === 'error') {
            return (
              <div key={q.id ?? idx}
                className="p-5 bg-white border border-red-200 rounded-2xl
                  dark:bg-gray-900 dark:border-red-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-600 bg-purple-50
                    dark:bg-purple-950/30 px-2.5 py-0.5 rounded-full border
                    border-purple-200 dark:border-purple-800">Q{idx + 1}</span>
                  <span className="ml-auto text-xs font-semibold text-red-500">
                    Evaluation failed
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {q.question}
                </p>
                <p className="text-xs text-gray-400">
                  Could not evaluate this answer. Your response has been saved.
                </p>
              </div>
            );
          }

          // Full feedback card
          return (
            <FeedbackCard
              key={q.id ?? idx}
              index={idx}
              question={q.question}
              answer={answer}
              feedback={feedback}
              category={q.category}
            />
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Confirm finish dialog
// ---------------------------------------------------------------------------
const FinishConfirmDialog = ({ onConfirm, onCancel, answeredCount, totalCount, isSubmitting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Finish Interview?</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            You've answered {answeredCount} of {totalCount} questions.
            {answeredCount < totalCount && ` ${totalCount - answeredCount} will be marked as skipped.`}
          </p>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          Keep Going
        </button>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition shadow cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Saving...
            </>
          ) : 'Finish'}
        </button>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const InterviewSession = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Interview data
  const [interview, setInterview]       = useState(null);
  const [questions, setQuestions]       = useState([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [loadError, setLoadError]       = useState('');

  // Navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers stored locally: { [questionIndex]: string }
  const [answers, setAnswers]           = useState({});

  // UI state
  const [showHint, setShowHint]               = useState(false);
  const [isFinished, setIsFinished]           = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [showCamera, setShowCamera]           = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  // Per-question timer (resets on navigation)
  const [timeLeft, setTimeLeft]         = useState(SECONDS_PER_QUESTION);
  const timerRef                        = useRef(null);

  // Textarea ref so we can focus it on question change (kept for potential manual text input)
  const textareaRef = useRef(null); // eslint-disable-line no-unused-vars

  // -------------------------------------------------------------------------
  // Voice (SpeechSynthesis)
  // -------------------------------------------------------------------------
  const {
    status:       voiceStatus,
    isSpeaking,
    isPaused:     voiceIsPaused,
    isUnsupported: voiceUnsupported,
    answerEnabled: _answerEnabled,
    speak,
    pause:        pauseSpeech,
    resume:       resumeSpeech,
    stop:         stopSpeech,
    repeat:       repeatSpeech,
  } = useVoice();

  // -------------------------------------------------------------------------
  // Fetch interview + questions from backend
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchInterview = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const res = await api.get(`/interview/detail/${id}`);
        const data = res.data;
        setInterview(data);
        const qs = data.questions || [];
        setQuestions(qs);
        if (qs.length === 0) {
          setLoadError('This interview has no questions. Please create a new interview.');
        }
      } catch (err) {
        setLoadError(
          err.response?.data?.message || 'Failed to load interview. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchInterview();
  }, [id]);

  // -------------------------------------------------------------------------
  // Timer — resets whenever currentIndex changes or interview finishes
  // -------------------------------------------------------------------------
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(SECONDS_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (isLoading || isFinished || questions.length === 0) return;
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [currentIndex, isLoading, isFinished, questions.length, startTimer]);

  // -------------------------------------------------------------------------
  // Auto-speak — read the question aloud whenever it changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isLoading || isFinished || questions.length === 0) return;
    const q = questions[currentIndex];
    if (q?.question) speak(q.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isLoading, isFinished, questions]);

  // -------------------------------------------------------------------------
  // Stop speech when interview finishes or component unmounts
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isFinished) stopSpeech();
  }, [isFinished, stopSpeech]);

  // -------------------------------------------------------------------------
  // Focus textarea when question changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isLoading && !isFinished && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentIndex, isLoading, isFinished]);

  // -------------------------------------------------------------------------
  // Answer helpers
  // -------------------------------------------------------------------------
  const currentAnswer = answers[currentIndex] ?? '';

  const setCurrentAnswer = (value) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const goTo = (index) => {
    stopSpeech();
    setShowHint(false);
    setCurrentIndex(index);
  };

  const handlePrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
  };

  // -------------------------------------------------------------------------
  // Submit single answer → backend → advance to next question
  // -------------------------------------------------------------------------
  const handleSubmitAnswer = useCallback(async () => {
    const currentQ   = questions[currentIndex];
    const answerText = answers[currentIndex] ?? '';

    if (!answerText.trim()) return;

    setIsSubmittingAnswer(true);
    try {
      await api.post(`/interview/${id}/answers`, {
        questionId:   currentQ.id ?? currentIndex + 1,
        questionText: currentQ.question || '',
        answerText:   answerText.trim(),
      });
    } catch (err) {
      // Non-fatal — answer already stored locally; backend save is best-effort
      console.error('[STT] Failed to save answer to backend:', err.message);
    } finally {
      setIsSubmittingAnswer(false);
    }

    // Advance to next question, or finish if on last
    if (currentIndex < questions.length - 1) {
      goTo(currentIndex + 1);
    } else {
      setShowConfirm(true);
    }
  }, [questions, currentIndex, answers, id, goTo]);

  const handleFinish = async () => {
    clearInterval(timerRef.current);
    setShowConfirm(false);
    setIsSubmitting(true);

    // Build payload — only include questions that were answered
    const answeredPayload = questions
      .map((q, idx) => ({
        questionId:   q.id ?? idx + 1,
        questionText: q.question || '',
        answerText:   answers[idx] || '',
      }))
      .filter((a) => a.answerText.trim());

    if (answeredPayload.length > 0) {
      try {
        await api.post(`/interview/${id}/answers/bulk`, { answers: answeredPayload });
      } catch (err) {
        // Non-fatal — answers are still shown in the results screen from local state
        console.error('Failed to save answers to backend:', err.message);
      }
    }

    setIsSubmitting(false);
    setIsFinished(true);
  };

  // -------------------------------------------------------------------------
  // Early returns
  // -------------------------------------------------------------------------
  if (isLoading) return <LoadingScreen />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
        <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl text-center max-w-md space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{loadError}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <ResultsScreen
        questions={questions}
        answers={answers}
        interviewMeta={interview}
        interviewId={id}
        navigate={navigate}
      />
    );
  }

  const currentQ = questions[currentIndex];

  // Guard: questions loaded but empty or currentIndex out of range
  if (!currentQ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
        <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-center max-w-md space-y-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            No questions were generated for this interview.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This can happen when the AI question generator is unavailable. Please try creating a new interview.
          </p>
          <div className="flex gap-3 justify-center pt-1">
            <button
              onClick={() => navigate(interview?.interviewType === 'resume' ? '/create-resume-interview' : interview?.interviewType === 'hr' ? '/create-hr-interview' : '/create-interview')}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl cursor-pointer transition"
            >
              New Interview
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === questions.length - 1;

  // -------------------------------------------------------------------------
  // Main interview UI
  // -------------------------------------------------------------------------
  return (
    <>
      {showConfirm && (
        <FinishConfirmDialog
          answeredCount={answeredCount}
          totalCount={questions.length}
          onConfirm={handleFinish}
          onCancel={() => setShowConfirm(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Two-column layout when camera is open on lg+ screens */}
      <div className={`mx-auto px-4 py-8 animate-fadeIn ${showCamera ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className={`flex gap-6 items-start ${showCamera ? 'flex-col lg:flex-row' : 'flex-col'}`}>

          {/* ── Left / main column ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* ── Top bar: progress + timer + camera toggle ── */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                {/* Interview meta */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[180px]">
                    {interview?.jobRole || 'Interview'}
                  </span>
                  <DifficultyBadge difficulty={interview?.difficulty} />
                </div>

                {/* Right side: timer + camera toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <TimerBadge seconds={timeLeft} />

                  {/* Camera toggle button */}
                  <button
                    onClick={() => setShowCamera((v) => !v)}
                    title={showCamera ? 'Hide camera panel' : 'Show camera panel'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      showCamera
                        ? 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500'
                    }`}
                  >
                    {showCamera ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                        Camera On
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                        Camera
                      </>
                    )}
                  </button>
                </div>
              </div>

              <ProgressBar current={currentIndex} total={questions.length} />
            </div>

            {/* ── Question card ── */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
              {/* Category pill */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full">
                  {currentQ.category || 'General'}
                </span>
                {/* Answered indicator */}
                {currentAnswer.trim() && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 11.586l6.293-6.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Answered
                  </span>
                )}
              </div>

              {/* Question text */}
              <p className="text-base font-semibold text-gray-900 dark:text-white leading-relaxed">
                {currentQ.question}
              </p>

              {/* ── Voice controls ── */}
              <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                <VoiceControls
                  status={voiceStatus}
                  isSpeaking={isSpeaking}
                  isPaused={voiceIsPaused}
                  isUnsupported={voiceUnsupported}
                  onPlay={() => speak(currentQ.question)}
                  onPause={pauseSpeech}
                  onResume={resumeSpeech}
                  onStop={stopSpeech}
                  onRepeat={repeatSpeech}
                />
              </div>

              {/* Hint toggle */}
              {currentQ.hints && (
                <div>
                  <button
                    onClick={() => setShowHint((v) => !v)}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {showHint ? 'Hide Hint' : 'Show Hint'}
                  </button>
                  {showHint && (
                    <div className="mt-2 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 leading-relaxed">
                      {currentQ.hints}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Answer panel: voice recording + transcript + fallback textarea ── */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Your Answer
                  {isSpeaking && (
                    <span className="ml-2 text-xs font-normal text-purple-500 dark:text-purple-400">
                      — listen to the question first
                    </span>
                  )}
                </label>
              </div>

              <SpeechAnswerPanel
                voiceIsDone={voiceStatus === 'done'}
                isSpeaking={isSpeaking}
                currentAnswer={currentAnswer}
                onAnswerChange={setCurrentAnswer}
                onSubmit={handleSubmitAnswer}
                isSubmitting={isSubmittingAnswer}
                questionIndex={currentIndex}
              />
            </div>

            {/* ── Navigation controls ── */}
            <div className="flex items-center gap-3">
              {/* Previous */}
              <button
                onClick={handlePrev}
                disabled={isFirst}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              {/* Question dot navigation */}
              <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap">
                {questions.map((_, idx) => {
                  const isAnswered = !!(answers[idx] && answers[idx].trim());
                  const isCurrent  = idx === currentIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => goTo(idx)}
                      title={`Question ${idx + 1}${isAnswered ? ' (answered)' : ''}`}
                      className={`w-7 h-7 rounded-full text-xs font-bold transition cursor-pointer border ${
                        isCurrent
                          ? 'bg-purple-600 text-white border-purple-600 scale-110'
                          : isAnswered
                          ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Next / Finish */}
              {isLast ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow transition cursor-pointer"
                >
                  Finish
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow transition cursor-pointer"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* ── Finish Interview shortcut ── */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShowConfirm(true)}
                className="text-xs font-semibold text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer underline-offset-2 hover:underline"
              >
                Finish Interview Early
              </button>
            </div>

          </div>
          {/* ── Right column: camera panel (only when toggled on) ── */}
          {showCamera && (
            <div className="w-full lg:w-80 xl:w-96 shrink-0">
              {/* Sticky so the camera stays visible while scrolling on desktop */}
              <div className="lg:sticky lg:top-24">
                <CameraPreview />
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default InterviewSession;
