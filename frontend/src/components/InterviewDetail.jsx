import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import FeedbackCard from './FeedbackCard';

const difficultyStyle = (d) => {
  if (d === 'Easy') return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800';
  if (d === 'Hard') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800';
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800';
};

const scoreStyle = (s) => {
  if (s == null) return 'text-gray-400';
  if (s >= 8) return 'text-green-600 dark:text-green-400';
  if (s >= 5) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
};

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ScoreRing = ({ score }) => {
  if (score == null) return null;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" className="dark:stroke-gray-700" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ * (1 - score / 10)} transform="rotate(-90 34 34)" />
      <text x="34" y="34" textAnchor="middle" dominantBaseline="central"
        fontSize="13" fontWeight="700" fill={color}>{score}/10</text>
    </svg>
  );
};

const Skeleton = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 animate-pulse">
    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
    <div className="p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-4">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
        {[0,1,2,3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
    </div>
    {[0,1,2].map((i) => (
      <div key={i} className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-3">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Main InterviewDetail component
// ---------------------------------------------------------------------------
const InterviewDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/interview/detail/${id}`);
        setInterview(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load interview details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (isLoading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 gap-4">
        <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl text-center max-w-md space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
          <button onClick={() => navigate('/dashboard')}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl cursor-pointer transition">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!interview) return null;

  const answerMap = {};
  (interview.answers || []).forEach((a) => { answerMap[a.questionId] = a; });

  const answeredCount  = (interview.answers || []).filter((a) => a.answerText && a.answerText.trim()).length;
  const evaluatedCount = (interview.answers || []).filter((a) => a.feedback && a.feedback.score != null).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">

      <Link to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      {/* Hero card */}
      <div className="p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 shadow-sm space-y-5">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white truncate">
              {interview.jobRole || 'Interview Report'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{fmt(interview.createdAt)}</p>
          </div>
          {interview.overallScore != null && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ScoreRing score={interview.overallScore} />
              <span className="text-xs text-gray-400 font-medium">Overall</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {interview.difficulty && (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${difficultyStyle(interview.difficulty)}`}>
              {interview.difficulty}
            </span>
          )}
          {interview.experienceLevel && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800">
              {interview.experienceLevel}
            </span>
          )}
          {interview.status && (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              interview.status === 'completed'
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
                : interview.status === 'in-progress'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800'
                : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
            }`}>
              {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
            </span>
          )}
        </div>

        {interview.skills && interview.skills.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Skills</p>
            <div className="flex flex-wrap gap-2">
              {interview.skills.map((skill) => (
                <span key={skill} className="text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          {[
            { label: 'Questions', value: interview.numberOfQuestions ?? interview.questions?.length ?? '—', colored: false },
            { label: 'Answered',  value: answeredCount, colored: false },
            { label: 'Evaluated', value: evaluatedCount, colored: false },
            { label: 'AI Score',  value: interview.overallScore != null ? `${interview.overallScore}/10` : '—', colored: true },
          ].map(({ label, value, colored }) => (
            <div key={label} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-4 py-3 text-center space-y-0.5">
              <p className={`text-xl font-extrabold ${colored ? scoreStyle(interview.overallScore) : 'text-gray-900 dark:text-white'}`}>
                {value}
              </p>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Questions & Feedback */}
      {interview.questions && interview.questions.length > 0 ? (
        <>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white px-1">Questions &amp; Feedback</h2>
          <div className="space-y-4">
            {interview.questions.map((q, idx) => {
              const qId = q.id ?? idx + 1;
              const answer = answerMap[qId] || null;
              return (
                <FeedbackCard
                  key={qId}
                  index={idx}
                  question={q.question}
                  category={q.category}
                  answer={answer?.answerText}
                  feedback={answer?.feedback}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-gray-400 dark:text-gray-500 text-sm">
          No questions found for this interview.
        </div>
      )}

    </div>
  );
};

export default InterviewDetail;
