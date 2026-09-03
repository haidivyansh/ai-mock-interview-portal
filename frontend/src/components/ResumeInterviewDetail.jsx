import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import FeedbackCard from './FeedbackCard';

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
  const r = 26, circ = 2 * Math.PI * r;
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

const Chip = ({ label }) => (
  <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20
    text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
    {label}
  </span>
);

const Section = ({ title, items }) => {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => <Chip key={i} label={item} />)}
      </div>
    </div>
  );
};

const Skeleton = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 animate-pulse">
    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
    <div className="p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-4">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main ResumeInterviewDetail
// ---------------------------------------------------------------------------
const ResumeInterviewDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get(`/interview/detail/${id}`)
      .then(({ data }) => setInterview(data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load report.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800
          rounded-2xl text-center max-w-md space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
          <button onClick={() => navigate('/dashboard')}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm
              font-semibold rounded-xl cursor-pointer transition">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!interview) return null;

  const rd = interview.resumeData || {};
  const answerMap = {};
  (interview.answers || []).forEach(a => { answerMap[a.questionId] = a; });

  const answeredCount  = (interview.answers || []).filter(a => a.answerText?.trim()).length;
  const evaluatedCount = (interview.answers || []).filter(a => a.feedback?.score != null).length;
  const overallScore   = interview.overallScore ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">

      <Link to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500
          dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      {/* ── Hero card ── */}
      <div className="p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900
        dark:border-gray-800 shadow-sm space-y-5">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30
                px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                Resume Interview
              </span>
              {interview.status && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  interview.status === 'completed'
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800'
                }`}>{interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}</span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {rd.candidateName || 'Resume Interview'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{fmt(interview.createdAt)}</p>
          </div>
          {overallScore != null && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ScoreRing score={overallScore} />
              <span className="text-xs text-gray-400 font-medium">Overall</span>
            </div>
          )}
        </div>

        {/* File info */}
        {rd.originalFileName && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{rd.originalFileName}</p>
              <p className="text-xs text-gray-400">Uploaded resume</p>
            </div>
          </div>
        )}

        {/* Resume summary */}
        {rd.summary && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resume Summary</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{rd.summary}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Questions', value: interview.numberOfQuestions ?? '—' },
            { label: 'Answered',  value: answeredCount },
            { label: 'Evaluated', value: evaluatedCount },
            { label: 'AI Score',  value: overallScore != null ? `${overallScore}/10` : '—', colored: true },
          ].map(({ label, value, colored }) => (
            <div key={label} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-4 py-3 text-center space-y-0.5">
              <p className={`text-xl font-extrabold ${colored ? scoreStyle(overallScore) : 'text-gray-900 dark:text-white'}`}>{value}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Resume Analysis ── */}
      {(rd.technicalSkills?.length > 0 || rd.languages?.length > 0 || rd.projects?.length > 0) && (
        <div className="p-6 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 space-y-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Resume Analysis</h2>
          <Section title="Technical Skills"   items={rd.technicalSkills} />
          <Section title="Programming Languages" items={rd.languages} />
          <Section title="Frameworks"         items={rd.frameworks} />
          <Section title="Databases"          items={rd.databases} />
          <Section title="Tools"              items={rd.tools} />
          <Section title="Certifications"     items={rd.certifications} />
          {rd.projects?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</p>
              <ul className="space-y-1.5">
                {rd.projects.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rd.experience?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Experience</p>
              <ul className="space-y-1.5">
                {rd.experience.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Q&A + Feedback ── */}
      {interview.questions?.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white px-1">Questions &amp; AI Feedback</h2>
          <div className="space-y-4">
            {interview.questions.map((q, idx) => {
              const qId = q.id ?? idx + 1;
              const answer = answerMap[qId] || null;
              return (
                <FeedbackCard
                  key={qId}
                  index={idx}
                  question={q.question}
                  category={q.category || 'Resume-Based'}
                  answer={answer?.answerText}
                  feedback={answer?.feedback}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ResumeInterviewDetail;
