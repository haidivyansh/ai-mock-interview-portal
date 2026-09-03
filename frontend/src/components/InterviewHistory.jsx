import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';

const difficultyStyle = (d) => {
  if (d === 'Easy') return 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400';
  if (d === 'Hard') return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
};

const scoreStyle = (s) => {
  if (s == null) return 'text-gray-400 dark:text-gray-500';
  if (s >= 8) return 'text-green-600 dark:text-green-400';
  if (s >= 5) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
};

const statusStyle = (status) => {
  switch (status) {
    case 'completed':
      return 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400';
    case 'in-progress':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

const TableSkeleton = () => (
  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </td>
        <td className="px-6 py-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </td>
        <td className="px-6 py-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </td>
        <td className="px-6 py-4 text-right">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 ml-auto" />
        </td>
      </tr>
    ))}
  </tbody>
);

const InterviewHistory = () => {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter, setFilter] = useState('all'); // all | role | resume
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchInterviews = async () => {
      setIsLoading(true);
      setFetchError('');
      try {
        const { data } = await api.get('/interview/user/all');
        setInterviews(data.interviews || []);
      } catch (err) {
        setFetchError(err.response?.data?.message || 'Could not load interview history.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInterviews();
  }, []);

  const filtered = useMemo(() => {
    return interviews.filter((i) => {
      if (filter === 'role'   && i.interviewType !== 'role')   return false;
      if (filter === 'resume' && i.interviewType !== 'resume') return false;
      if (filter === 'hr'     && i.interviewType !== 'hr')     return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const role = (i.jobRole || '').toString().toLowerCase();
        if (!role.includes(q)) return false;
      }
      return true;
    });
  }, [interviews, filter, search]);

  const totalCount = interviews.length;
  const completedCount = interviews.filter((i) => i.status === 'completed').length;
  const scored = interviews.filter((i) => i.overallScore != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, i) => s + i.overallScore, 0) / scored.length)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 animate-fadeIn space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="px-3 py-1 text-xs font-semibold tracking-wider text-purple-600 uppercase bg-purple-100 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
            Sessions
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Interview History
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Review all your past mock interviews and AI feedback reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="p-6 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sessions</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">{totalCount}</h3>
            <span className="inline-flex items-center text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400 px-2 py-0.5 rounded-full">
              {completedCount} completed
            </span>
          </div>
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950/40 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completion Rate</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%
            </h3>
            <span className="inline-flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400 px-2 py-0.5 rounded-full">
              {completedCount} / {totalCount} sessions
            </span>
          </div>
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Average AI Score</p>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-3xl font-extrabold ${scoreStyle(avgScore)}`}>
                {avgScore != null ? `${avgScore}` : '—'}
              </h3>
              {avgScore != null && <span className="text-sm font-semibold text-gray-400">/ 10</span>}
            </div>
            <div className="w-32 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-700"
                style={{ width: `${avgScore != null ? (avgScore / 10) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {[
            { k: 'all',    label: 'All Interviews' },
            { k: 'role',   label: 'Role-Based' },
            { k: 'resume', label: 'Resume-Based' },
            { k: 'hr',     label: 'HR-Based' },
          ].map(({ k, label }) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {filter === 'role' ? 'Role-Based Interviews' : filter === 'resume' ? 'Resume-Based Interviews' : filter === 'hr' ? 'HR-Based Interviews' : 'All Interviews'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {totalCount} sessions
            </p>
          </div>
          <button
            onClick={() => navigate('/create-interview')}
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 cursor-pointer"
          >
            + Start New
          </button>
        </div>

        {fetchError && (
          <div className="px-6 py-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20">
            {fetchError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/40 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-800">
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Difficulty</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">AI Score</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      No interviews found
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {search
                        ? 'Try a different search term or filter.'
                        : 'Start your first mock interview to see results here.'}
                    </p>
                    {!search && (
                      <div className="mt-5 flex gap-3 justify-center flex-wrap">
                        <button
                          onClick={() => navigate('/create-interview')}
                          className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition cursor-pointer"
                        >
                          Role-Based Interview
                        </button>
                        <button
                          onClick={() => navigate('/create-resume-interview')}
                          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition cursor-pointer"
                        >
                          Resume-Based Interview
                        </button>
                        <button
                          onClick={() => navigate('/create-hr-interview')}
                          className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition cursor-pointer"
                        >
                          HR-Based Interview
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {filtered
                  .slice()
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((item) => {
                    const isResume = item.interviewType === 'resume';
                    const isHr     = item.interviewType === 'hr';
                    const detailRoute = isResume
                      ? `/resume-interview-detail/${item.id}`
                      : `/interview-detail/${item.id}`;
                    const displayRole = isResume
                      ? item.jobRole || 'Resume Interview'
                      : isHr
                      ? item.jobRole || 'HR Interview'
                      : item.jobRole;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition duration-150">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white max-w-[220px] truncate">
                          {displayRole}
                        </td>
                        <td className="px-6 py-4">
                          {isResume ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                              </svg>
                              Resume
                            </span>
                          ) : isHr ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              HR
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Role
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          {isResume || isHr ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${difficultyStyle(item.difficulty)}`}>
                              {item.difficulty || '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle(item.status)}`}>
                            {capitalize(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${scoreStyle(item.overallScore)}`}>
                            {item.overallScore != null ? `${item.overallScore}/10` : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={detailRoute}
                            className={`text-xs font-bold hover:underline ${
                              isResume
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : isHr
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            View Report →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default InterviewHistory;
