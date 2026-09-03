import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const difficultyStyle = (d) => {
  if (d === 'Easy') return 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400';
  if (d === 'Hard') return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
};

const scoreStyle = (s) => {
  if (s == null) return 'text-gray-400 dark:text-gray-500';
  if (s >= 8) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 5) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
};

const scoreGradient = (s) => {
  if (s == null) return '#94a3b8';
  if (s >= 8) return '#10b981';
  if (s >= 5) return '#f59e0b';
  return '#ef4444';
};

const levelInfo = (avg) => {
  if (avg == null) return { label: 'Not rated', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', emoji: '🎯' };
  if (avg >= 9)  return { label: 'Expert',       color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40',  emoji: '🏆' };
  if (avg >= 7)  return { label: 'Advanced',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', emoji: '⭐' };
  if (avg >= 5)  return { label: 'Intermediate', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40',    emoji: '📈' };
  return              { label: 'Beginner',      color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40',       emoji: '💪' };
};

// ─── Animated Score Ring ──────────────────────────────────────────────────────

const ScoreRing = ({ score, size = 100 }) => {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(1, score / 10) : 0;
  const color = scoreGradient(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
        strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="6"
        stroke={color} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fontSize={Math.round(size * 0.18)} fontWeight="800"
        fill="currentColor" className="fill-gray-900 dark:fill-white rotate-90"
        transform={`rotate(90, ${size/2}, ${size/2})`}>
        {score != null ? `${score}` : '—'}
      </text>
    </svg>
  );
};

// ─── Tips Carousel ────────────────────────────────────────────────────────────

const tips = [
  { icon: '🎤', text: 'Use the STAR method for behavioral questions — Situation, Task, Action, Result.' },
  { icon: '⏱️', text: 'You have 5 minutes per question. Practice speaking for at least 2–3 minutes on each.' },
  { icon: '🧠', text: 'Resume-based mode uses your actual projects. Keep your resume updated for best results.' },
  { icon: '📊', text: 'AI evaluates technical accuracy, communication, and completeness separately.' },
  { icon: '🔁', text: 'Retake the same interview to see score improvements over time.' },
  { icon: '💡', text: 'Enable camera mode to practice eye contact and body language during sessions.' },
];

const TipsCarousel = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % tips.length), 4000);
    return () => clearInterval(t);
  }, []);
  const tip = tips[idx];
  return (
    <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl min-h-[72px]">
      <span className="text-2xl shrink-0 mt-0.5">{tip.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-0.5">Pro Tip</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tip.text}</p>
      </div>
      <div className="flex gap-1 shrink-0 mt-1">
        {tips.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${i === idx ? 'bg-violet-500 w-3' : 'bg-violet-200 dark:bg-violet-800'}`} />
        ))}
      </div>
    </div>
  );
};

// ─── Activity Heatmap (last 12 weeks from real data) ─────────────────────────

const ActivityHeatmap = ({ interviews }) => {
  const weeks = 12;
  const today = new Date();
  // Build a map of date → count
  const counts = {};
  interviews.forEach(iv => {
    const d = new Date(iv.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  // Build grid: weeks × 7 days, newest at right
  const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const week = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(today.getDate() - (w * 7 + d));
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      week.push({ date, count: counts[key] || 0 });
    }
    cells.push(week.reverse());
  }

  const getColor = (count) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count === 1) return 'bg-violet-200 dark:bg-violet-900/60';
    if (count === 2) return 'bg-violet-400 dark:bg-violet-700';
    return 'bg-violet-600 dark:bg-violet-500';
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {cells.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) => (
              <div key={di} title={`${cell.date.toDateString()}: ${cell.count} interview${cell.count !== 1 ? 's' : ''}`}
                className={`w-3 h-3 rounded-sm cursor-default transition-colors ${getColor(cell.count)}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-[10px] text-gray-400">Less</span>
        {['bg-gray-100 dark:bg-gray-800','bg-violet-200 dark:bg-violet-900/60','bg-violet-400 dark:bg-violet-700','bg-violet-600 dark:bg-violet-500'].map((c,i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-gray-400">More</span>
      </div>
    </div>
  );
};

// ─── Streak Counter ───────────────────────────────────────────────────────────

const calcStreak = (interviews) => {
  if (!interviews.length) return 0;
  const days = new Set(interviews.map(iv => {
    const d = new Date(iv.createdAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
};

// ─── Table skeleton ───────────────────────────────────────────────────────────

const TableSkeleton = () => (
  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
    {[...Array(3)].map((_, i) => (
      <tr key={i} className="animate-pulse">
        {[...Array(6)].map((__, j) => (
          <td key={j} className="px-5 py-3.5">
            <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4" />
          </td>
        ))}
        <td className="px-5 py-3.5 text-right">
          <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded-full w-14 ml-auto" />
        </td>
      </tr>
    ))}
  </tbody>
);

// ─── Interview Mode Card ──────────────────────────────────────────────────────

const InterviewCard = ({ icon, title, desc, tag, accentFrom, accentTo, borderHover, badgeBg, badgeText, btnBg, btnHover, onClick, count }) => (
  <button onClick={onClick}
    className={`group relative overflow-hidden text-left w-full rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer ${borderHover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500`}>
    <div className={`h-1 w-full bg-gradient-to-r ${accentFrom} ${accentTo}`} />
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${accentFrom} ${accentTo} text-white shadow-sm group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${badgeBg} ${badgeText}`}>{tag}</span>
          {count > 0 && <span className="text-[10px] text-gray-400">{count} session{count !== 1 ? 's' : ''}</span>}
        </div>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
      </div>
      <div className={`mt-1 inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl text-sm font-semibold text-white ${btnBg} ${btnHover} transition-all duration-200 shadow-sm group-hover:shadow-md`}>
        Start Interview
        <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </div>
  </button>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon, iconBg, iconColor, bar, barColor, loading }) => (
  <div className="relative overflow-hidden p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      {loading ? <div className="h-7 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        : <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</p>}
      {sub && !loading && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{sub}</p>}
      {bar != null && !loading && (
        <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.min(100, (bar / 10) * 100)}%` }} />
        </div>
      )}
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const fetchInterviews = async () => {
      setIsLoading(true); setFetchError('');
      try {
        const { data } = await api.get('/interview/user/all');
        setInterviews(data.interviews || []);
      } catch (err) {
        setFetchError(err.response?.data?.message || 'Could not load interview history.');
      } finally { setIsLoading(false); }
    };
    fetchInterviews();
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalInterviews  = interviews.length;
  const completedCount   = interviews.filter(i => i.status === 'completed').length;
  const scoredInterviews = interviews.filter(i => i.overallScore != null);
  const avgScore   = scoredInterviews.length > 0
    ? Math.round(scoredInterviews.reduce((s, i) => s + i.overallScore, 0) / scoredInterviews.length) : null;
  const bestScore  = scoredInterviews.length > 0 ? Math.max(...scoredInterviews.map(i => i.overallScore)) : null;
  const streak     = calcStreak(interviews);
  const level      = levelInfo(avgScore);

  const roleCount   = interviews.filter(i => i.interviewType === 'role').length;
  const resumeCount = interviews.filter(i => i.interviewType === 'resume').length;
  const hrCount     = interviews.filter(i => i.interviewType === 'hr').length;

  const recent = interviews.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  const getInitials = (n) => n ? n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white shadow-xl shadow-purple-900/20">
        <div className="pointer-events-none absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 right-24 w-56 h-56 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Left: avatar + name */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl sm:text-2xl font-extrabold ring-2 ring-white/10">
                {getInitials(user?.name)}
              </div>
              {streak > 0 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-[10px] font-black text-amber-900">
                  {streak}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-purple-200 text-xs font-semibold uppercase tracking-widest mb-0.5">{greeting}</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight truncate">
                {user?.name?.split(' ')[0] || 'User'} 👋
              </h2>
              <p className="text-purple-300 text-sm mt-0.5 truncate">{user?.email}</p>
              {streak > 0 && (
                <p className="text-amber-300 text-xs mt-1 font-semibold">🔥 {streak}-day streak</p>
              )}
            </div>
          </div>

          {/* Right: score ring + level */}
          <div className="flex items-center gap-5 shrink-0">
            {!isLoading && (
              <div className="flex flex-col items-center gap-1.5">
                <ScoreRing score={avgScore} size={88} />
                <span className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Avg Score</span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm ${level.bg} ${level.color}`}>
                <span>{level.emoji}</span>{level.label}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl border border-white/15 text-sm">
                <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold">{isLoading ? '…' : completedCount}</span>
                <span className="text-purple-300 text-xs">Completed</span>
              </div>
              {bestScore != null && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl border border-white/15 text-sm">
                  <span className="text-amber-300">🏆</span>
                  <span className="font-bold">{bestScore}/10</span>
                  <span className="text-purple-300 text-xs">Best</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 px-6 sm:px-8 pb-5">
          <p className="text-purple-200/80 text-sm leading-relaxed max-w-xl">
            AI-powered mock interviews with real-time speech evaluation, personalised questions, and detailed feedback.
          </p>
        </div>
      </div>

      {/* ── TIPS + ACTIVITY ROW ──────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TipsCarousel />

        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Activity</p>
              <p className="text-xs text-gray-400">Last 12 weeks</p>
            </div>
            {streak > 0 && (
              <span className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                🔥 {streak} day streak
              </span>
            )}
          </div>
          {isLoading
            ? <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            : <ActivityHeatmap interviews={interviews} />}
        </div>
      </div>

      {/* ── INTERVIEW MODE CARDS ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Start an Interview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Pick a mode — AI handles the rest</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <InterviewCard
            title="Experience-Based Interview"
            desc="Choose a role, skills & difficulty. Gemini AI generates targeted technical questions."
            tag="Technical" count={roleCount}
            accentFrom="from-violet-500" accentTo="to-purple-600"
            borderHover="hover:border-violet-400 dark:hover:border-violet-600"
            badgeBg="bg-violet-50 dark:bg-violet-950/40" badgeText="text-violet-600 dark:text-violet-400"
            btnBg="bg-violet-600" btnHover="hover:bg-violet-700"
            onClick={() => navigate('/create-interview')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
          />
          <InterviewCard
            title="Resume-Based Interview"
            desc="Upload your resume — AI reads your projects and experience to ask personalised questions."
            tag="Personalised" count={resumeCount}
            accentFrom="from-indigo-500" accentTo="to-blue-600"
            borderHover="hover:border-indigo-400 dark:hover:border-indigo-600"
            badgeBg="bg-indigo-50 dark:bg-indigo-950/40" badgeText="text-indigo-600 dark:text-indigo-400"
            btnBg="bg-indigo-600" btnHover="hover:bg-indigo-700"
            onClick={() => navigate('/create-resume-interview')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>}
          />
          <InterviewCard
            title="HR-Based Interview"
            desc="Behavioral & situational questions — strengths, goals, leadership, conflict, STAR scenarios."
            tag="Behavioral" count={hrCount}
            accentFrom="from-rose-500" accentTo="to-pink-600"
            borderHover="hover:border-rose-400 dark:hover:border-rose-600"
            badgeBg="bg-rose-50 dark:bg-rose-950/40" badgeText="text-rose-600 dark:text-rose-400"
            btnBg="bg-rose-600" btnHover="hover:bg-rose-700"
            onClick={() => navigate('/create-hr-interview')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Progress</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Based on all your sessions</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Interviews" value={isLoading ? '—' : totalInterviews}
            sub={isLoading ? null : `${completedCount} completed · ${totalInterviews - completedCount} pending`}
            loading={isLoading} iconBg="bg-violet-50 dark:bg-violet-950/40" iconColor="text-violet-600 dark:text-violet-400"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          />
          <StatCard label="Completed" value={isLoading ? '—' : completedCount}
            sub={isLoading || totalInterviews === 0 ? null : `${Math.round((completedCount / totalInterviews) * 100)}% completion rate`}
            loading={isLoading} iconBg="bg-emerald-50 dark:bg-emerald-950/40" iconColor="text-emerald-600 dark:text-emerald-400"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard label="Average AI Score" value={isLoading ? '—' : avgScore != null ? `${avgScore}/10` : '—'}
            sub={isLoading ? null : avgScore != null ? `Across ${scoredInterviews.length} evaluated sessions` : 'No scored sessions yet'}
            bar={avgScore} barColor="bg-gradient-to-r from-violet-500 to-purple-600"
            loading={isLoading} iconBg="bg-amber-50 dark:bg-amber-950/40" iconColor="text-amber-500 dark:text-amber-400"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          <StatCard label="Best Score" value={isLoading ? '—' : bestScore != null ? `${bestScore}/10` : '—'}
            sub={isLoading ? null : bestScore != null ? 'Personal best across all sessions' : 'Complete an interview to see'}
            bar={bestScore} barColor="bg-gradient-to-r from-emerald-500 to-teal-500"
            loading={isLoading} iconBg="bg-rose-50 dark:bg-rose-950/40" iconColor="text-rose-500 dark:text-rose-400"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
          />
        </div>
      </section>

      {/* ── MODE BREAKDOWN BAR ──────────────────────────────────────────────── */}
      {totalInterviews > 0 && !isLoading && (
        <section className="p-5 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-sm">
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">Session Breakdown</p>
          <div className="space-y-3">
            {[
              { label: 'Experience-Based', count: roleCount,   color: 'bg-violet-500', textColor: 'text-violet-600 dark:text-violet-400' },
              { label: 'Resume-Based',     count: resumeCount, color: 'bg-indigo-500', textColor: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'HR-Based',         count: hrCount,     color: 'bg-rose-500',   textColor: 'text-rose-600 dark:text-rose-400' },
            ].map(({ label, count, color, textColor }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-36 shrink-0">{label}</span>
                <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${totalInterviews > 0 ? (count / totalInterviews) * 100 : 0}%` }} />
                </div>
                <span className={`text-xs font-bold w-8 text-right tabular-nums ${textColor}`}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RECENT INTERVIEWS ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Sessions</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Latest 5 interviews with AI scores</p>
          </div>
          <Link to="/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors">
            View all
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>

        {fetchError && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            {fetchError}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-800/50 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3.5 pl-6">Role</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Difficulty</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">AI Score</th>
                  <th className="px-5 py-3.5 text-right pr-6">Report</th>
                </tr>
              </thead>
              {isLoading ? <TableSkeleton />
                : recent.length === 0 ? (
                  <tbody><tr><td colSpan={7} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No interviews yet</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Pick an interview type above to get started</p>
                    </div>
                  </td></tr></tbody>
                ) : (
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-sm">
                    {recent.map((item) => {
                      const isResume = item.interviewType === 'resume';
                      const isHr     = item.interviewType === 'hr';
                      const detailRoute = isResume ? `/resume-interview-detail/${item.id}` : `/interview-detail/${item.id}`;
                      const displayRole = isResume ? (item.jobRole || 'Resume Interview') : isHr ? (item.jobRole || 'HR Interview') : item.jobRole;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors duration-150">
                          <td className="px-5 py-3.5 pl-6 font-semibold text-gray-900 dark:text-white max-w-[180px] truncate">{displayRole}</td>
                          <td className="px-5 py-3.5">
                            {isResume ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>
                                Resume
                              </span>
                            ) : isHr ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                HR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border border-violet-100 dark:border-violet-900/50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                Role
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3.5">
                            {isResume || isHr ? <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                              : <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${difficultyStyle(item.difficulty)}`}>{item.difficulty || '—'}</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                              item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                              : item.status === 'in-progress' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                              {item.status === 'completed' && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>}
                              {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-sm font-extrabold tabular-nums ${scoreStyle(item.overallScore)}`}>
                              {item.overallScore != null ? `${item.overallScore}/10` : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right pr-6">
                            <Link to={detailRoute}
                              className={`inline-flex items-center gap-1 text-xs font-bold hover:underline underline-offset-2 transition-colors ${
                                isResume ? 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700'
                                : isHr ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                                : 'text-violet-600 dark:text-violet-400 hover:text-violet-700'}`}>
                              View
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                )}
            </table>
          </div>

          {/* Mobile list */}
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading ? (
              <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : recent.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No interviews yet. Start one above!</div>
            ) : (
              recent.map((item) => {
                const isResume = item.interviewType === 'resume';
                const isHr     = item.interviewType === 'hr';
                const detailRoute = isResume ? `/resume-interview-detail/${item.id}` : `/interview-detail/${item.id}`;
                const displayRole = isResume ? (item.jobRole || 'Resume Interview') : isHr ? (item.jobRole || 'HR Interview') : item.jobRole;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayRole}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}
                        <span className={item.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}>
                          {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : '—'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-extrabold tabular-nums ${scoreStyle(item.overallScore)}`}>
                        {item.overallScore != null ? `${item.overallScore}/10` : '—'}
                      </span>
                      <Link to={detailRoute}
                        className={`text-xs font-bold ${isResume ? 'text-indigo-600 dark:text-indigo-400' : isHr ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'}`}>
                        View →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ── QUICK LINKS ──────────────────────────────────────────────────────── */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => navigate('/history')}
            className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all duration-200 cursor-pointer text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Interview History</p>
              <p className="text-xs text-gray-400 truncate">Browse all sessions &amp; feedback reports</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={() => navigate('/profile')}
            className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all duration-200 cursor-pointer text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">My Profile</p>
              <p className="text-xs text-gray-400 truncate">Update account details &amp; settings</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
