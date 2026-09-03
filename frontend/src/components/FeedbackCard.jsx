import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const scoreColor = (score) => {
  if (score == null || isNaN(score)) return { ring: 'text-gray-400',  bg: 'bg-gray-300',  label: 'text-gray-500',  badge: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' };
  if (score >= 8) return { ring: 'text-green-500',  bg: 'bg-green-500',  label: 'text-green-600 dark:text-green-400',  badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800' };
  if (score >= 5) return { ring: 'text-amber-500',  bg: 'bg-amber-500',  label: 'text-amber-600 dark:text-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800' };
  return             { ring: 'text-red-500',    bg: 'bg-red-500',    label: 'text-red-600 dark:text-red-400',    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800' };
};

const scoreVerb = (score) => {
  if (score == null || isNaN(score)) return '—';
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Fair';
  if (score >= 3) return 'Needs Work';
  return 'Poor';
};

const getOverall = (fb) => {
  if (fb == null) return null;
  const v = fb.overallScore ?? fb.score;
  if (v == null || v === '' || isNaN(Number(v))) return null;
  return Number(v);
};

const get = (fb, key, fallback = '') => (fb && fb[key] != null && fb[key] !== '' ? fb[key] : fallback);
const getArr = (fb, key, altKey) => {
  if (!fb) return [];
  const a = Array.isArray(fb[key]) ? fb[key] : null;
  const b = Array.isArray(fb[altKey]) ? fb[altKey] : null;
  return ((a && a.length ? a : b) || []).filter((x) => typeof x === 'string' && x.trim());
};

// Circular score ring drawn with SVG
const ScoreRing = ({ score, size = 72 }) => {
  if (score == null) return null;
  const r = Math.round((size - 12) / 2);
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(1, Math.max(0, score / 10));
  const { ring } = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6"
        stroke="currentColor" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={ring} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={Math.round(size * 0.22)} fontWeight="700"
        className="fill-gray-900 dark:fill-white" fill="currentColor">
        {score}/10
      </text>
    </svg>
  );
};

// Horizontal bar for sub-scores
const ScoreBar = ({ label, value, max = 10 }) => {
  if (value == null || isNaN(Number(value))) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-gray-600 dark:text-gray-400">{label}</span>
          <span className="text-gray-400">—</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
    );
  }
  const v = Math.round(Number(value));
  const pct = Math.min(100, Math.round((v / max) * 100));
  const { bg, label: labelColor } = scoreColor(v);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className={labelColor}>{v}/{max}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${bg}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// Small generic pill list
const BulletList = ({ items, variant = 'default' }) => {
  if (!items || items.length === 0) return null;
  const variants = {
    strength:  { bullet: 'bg-green-500',  text: 'text-gray-700 dark:text-gray-300' },
    weakness:  { bullet: 'bg-red-500',    text: 'text-gray-700 dark:text-gray-300' },
    suggestion:{ bullet: 'bg-purple-500', text: 'text-gray-700 dark:text-gray-300' },
    followup:  { bullet: 'bg-indigo-500', text: 'text-gray-700 dark:text-gray-300' },
    default:   { bullet: 'bg-gray-500',   text: 'text-gray-700 dark:text-gray-300' },
  };
  const { bullet, text } = variants[variant] || variants.default;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className={`flex items-start gap-2 text-sm leading-relaxed ${text}`}>
          <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${bullet}`} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
export const FeedbackCardSkeleton = ({ index }) => (
  <div className="p-5 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 space-y-4 animate-pulse">
    <div className="flex items-center gap-2 flex-wrap">
      <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
      <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="ml-auto w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </div>
    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
    <div className="flex items-center gap-4">
      <div className="w-18 h-18 rounded-2xl bg-gray-200 dark:bg-gray-700 w-[72px] h-[72px]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      </div>
    </div>
    <div className="text-xs text-center text-purple-500 dark:text-purple-400 font-medium">
      AI is evaluating Q{index + 1}…
    </div>
  </div>
);

// Accordion collapsible section
const Section = ({ title, subtitle, badge, children, defaultOpen = true, accent = 'gray' }) => {
  const [open, setOpen] = useState(defaultOpen);
  const accents = {
    gray:   'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800',
    green:  'text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400',
    red:    'text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
    purple: 'text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400',
    indigo: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400',
    yellow: 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400',
  };
  const accentCls = accents[accent] || accents.gray;
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer ${accentCls} transition`}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider shrink-0">{title}</span>
          {badge != null && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/20 border border-white/50 dark:border-white/10">
              {badge}
            </span>
          )}
          {subtitle && (
            <span className="text-xs opacity-70 truncate">{subtitle}</span>
          )}
        </div>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main FeedbackCard — renders ALL 10 fields per requirements
// Props:
//   question, answer, feedback, index, category
// ---------------------------------------------------------------------------
const FeedbackCard = ({ question, answer, feedback, index, category }) => {
  const fb = feedback || null;
  const overall = getOverall(fb);
  const { badge } = scoreColor(overall);

  const ideal     = get(fb, 'idealAnswer') || get(fb, 'correctAnswer');
  const evalSummary = get(fb, 'evaluation') || get(fb, 'technicalAccuracy');

  const strengths = getArr(fb, 'strengths');
  const weaknesses = getArr(fb, 'weaknesses');
  const suggestions = getArr(fb, 'improvementSuggestions', 'suggestions');
  const followups = getArr(fb, 'followUpQuestions');

  const techScore   = fb?.technicalScore;
  const commScore   = fb?.communicationScore;
  const compScore   = fb?.completenessScore;
  const psScore     = fb?.problemSolvingScore;
  const confScore   = fb?.confidenceScore;

  return (
    <article className="p-5 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/30
          px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
          Q{index + 1}
        </span>
        <span className="text-xs text-gray-400 font-medium">{category || 'General'}</span>
        <span className={`ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full border ${badge}`}>
          {scoreVerb(overall)}
          {overall != null && <> · {overall}/10</>}
        </span>
      </div>

      {/* ── Question (Requirement #9) ── */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Interview Question</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
          {question}
        </p>
      </div>

      {/* ── Scores block ── */}
      <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-4 md:items-center">
        <div className="flex flex-col items-center gap-1">
          <ScoreRing score={overall} size={80} />
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Overall Score
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
          <ScoreBar label="Technical Correctness" value={techScore} />
          <ScoreBar label="Communication"         value={commScore} />
          <ScoreBar label="Completeness"          value={compScore} />
          <ScoreBar label="Problem Solving"       value={psScore} />
          <ScoreBar label="Confidence (from transcript)" value={confScore} />
          <ScoreBar label="Overall (weighted)"    value={overall} />
        </div>
      </div>

      {/* ── Evaluation Summary (always visible) ── */}
      {evalSummary && (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            AI Evaluation Summary
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {evalSummary}
          </p>
        </div>
      )}

      {/* ── User Answer (Requirement #9) ── */}
      {answer?.trim() && (
        <Section title="Your Answer" accent="gray" badge={answer.trim().split(/\s+/).length + ' words'}>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {answer}
          </p>
        </Section>
      )}

      {/* ── Ideal / Correct Answer (Requirement #9) ── */}
      {ideal && (
        <Section title="Correct / Ideal Answer" defaultOpen={false} accent="green" badge="Interview-ready">
          <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {ideal}
          </div>
        </Section>
      )}

      {/* ── Strengths + Weaknesses (Requirement #9) ── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Section
          title="Strengths"
          accent="green"
          badge={strengths.length ? `${strengths.length}` : undefined}
          defaultOpen={strengths.length > 0}
        >
          {strengths.length > 0
            ? <BulletList items={strengths} variant="strength" />
            : <p className="text-xs text-gray-400">No strengths captured.</p>}
        </Section>
        <Section
          title="Weaknesses"
          accent="red"
          badge={weaknesses.length ? `${weaknesses.length}` : undefined}
          defaultOpen={weaknesses.length > 0}
        >
          {weaknesses.length > 0
            ? <BulletList items={weaknesses} variant="weakness" />
            : <p className="text-xs text-gray-400">No significant weaknesses identified.</p>}
        </Section>
      </div>

      {/* ── Improvement Suggestions (Requirement #9) ── */}
      <Section
        title="Improvement Suggestions"
        accent="purple"
        badge={suggestions.length ? `${suggestions.length}` : undefined}
        defaultOpen={suggestions.length > 0}
      >
        {suggestions.length > 0
          ? <BulletList items={suggestions} variant="suggestion" />
          : <p className="text-xs text-gray-400">No suggestions yet.</p>}
      </Section>

      {/* ── Follow-up Questions (Requirement #9) ── */}
      <Section
        title="Follow-up Questions"
        accent="indigo"
        subtitle="Questions the interviewer would likely ask next"
        badge={followups.length ? `${followups.length}` : undefined}
        defaultOpen={followups.length > 0}
      >
        {followups.length > 0 ? (
          <ul className="space-y-2">
            {followups.map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[11px] font-bold flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                  Q{i + 1}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{q}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">No follow-up questions generated yet.</p>
        )}
      </Section>
    </article>
  );
};

export default FeedbackCard;
