import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const EXPERIENCE_LEVELS = [
  'Entry Level (0-2 yrs)',
  'Mid Level (2-5 yrs)',
  'Senior Level (5+ yrs)',
  'Lead / Manager',
];

const QUESTION_COUNTS = [3, 5, 7, 10];

const validate = ({ jobRole, numberOfQuestions }) => {
  const errors = {};
  if (!jobRole.trim()) {
    errors.jobRole = 'Job role is required.';
  } else if (jobRole.trim().length < 2) {
    errors.jobRole = 'Job role must be at least 2 characters.';
  }
  if (!numberOfQuestions) {
    errors.numberOfQuestions = 'Please select the number of questions.';
  }
  return errors;
};

const CreateHrInterview = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    jobRole:           '',
    experienceLevel:   '',
    targetCompany:     '',
    numberOfQuestions: '',
  });

  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setServerError('');

    try {
      const { data } = await api.post('/interview/hr/create', {
        jobRole:           form.jobRole.trim(),
        experienceLevel:   form.experienceLevel || 'Mid Level (2-5 yrs)',
        targetCompany:     form.targetCompany.trim(),
        numberOfQuestions: parseInt(form.numberOfQuestions, 10),
      });
      navigate(`/interview/${data.interview.id}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setServerError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 ' +
    'text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none ' +
    'focus:ring-2 transition duration-150';
  const inputNormal = 'border-gray-300 dark:border-gray-700 focus:ring-rose-500 focus:border-rose-500';
  const inputError  = 'border-red-400 dark:border-red-500 focus:ring-red-400 focus:border-red-400';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <span className="px-3 py-1 text-xs font-semibold tracking-wider text-rose-600
          uppercase bg-rose-100 rounded-full dark:bg-rose-900/30 dark:text-rose-400">
          HR Mode
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          HR-Based Interview
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          AI generates personalized behavioral and situational HR questions covering
          strengths, career goals, teamwork, leadership, conflict handling, and more.
        </p>
      </div>

      {/* Topic chips — visual preview of what's covered */}
      <div className="flex flex-wrap gap-2 mb-8">
        {[
          'Tell me about yourself','Strengths & Weaknesses','Career Goals',
          'Why hire you?','Company Motivation','Teamwork','Leadership',
          'Conflict Handling','Problem Solving','Adaptability','Work Ethics','Situational (STAR)',
        ].map((topic) => (
          <span key={topic}
            className="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-50
              text-rose-700 border border-rose-200 dark:bg-rose-950/20
              dark:text-rose-400 dark:border-rose-800">
            {topic}
          </span>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white dark:bg-gray-900 border border-gray-200
          dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
      >
        {/* Server error */}
        {serverError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20
            border border-red-200 dark:border-red-800 rounded-xl text-sm
            text-red-700 dark:text-red-400">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01M10.293 4.293a1 1 0 011.414 0L21 13.586V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-5.414z" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        {/* Job Role — required */}
        <div>
          <label htmlFor="jobRole"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Job Role You're Applying For <span className="text-red-500">*</span>
          </label>
          <input
            id="jobRole" name="jobRole" type="text"
            value={form.jobRole} onChange={handleChange}
            placeholder="e.g. Software Engineer, Product Manager, Data Analyst"
            className={`${inputBase} ${errors.jobRole ? inputError : inputNormal}`}
            aria-invalid={!!errors.jobRole}
          />
          {errors.jobRole && (
            <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.jobRole}</p>
          )}
        </div>

        {/* Target Company — optional */}
        <div>
          <label htmlFor="targetCompany"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Target Company
            <span className="ml-2 text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="targetCompany" name="targetCompany" type="text"
            value={form.targetCompany} onChange={handleChange}
            placeholder="e.g. Google, Infosys, a startup — AI will tailor motivation questions"
            className={`${inputBase} ${inputNormal}`}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Providing a company helps the AI personalise "Why do you want to work here?" type questions.
          </p>
        </div>

        {/* Experience Level */}
        <div>
          <label htmlFor="experienceLevel"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Experience Level
          </label>
          <select
            id="experienceLevel" name="experienceLevel"
            value={form.experienceLevel} onChange={handleChange}
            className={`${inputBase} ${inputNormal}`}
          >
            <option value="">Select level (defaults to Mid Level)</option>
            {EXPERIENCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>

        {/* Number of Questions */}
        <div>
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Number of Questions <span className="text-red-500">*</span>
          </span>
          <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="Number of questions">
            {QUESTION_COUNTS.map((count) => {
              const isSelected = form.numberOfQuestions === String(count);
              return (
                <button
                  key={count} type="button" role="radio" aria-checked={isSelected}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, numberOfQuestions: String(count) }));
                    if (errors.numberOfQuestions)
                      setErrors((prev) => ({ ...prev, numberOfQuestions: '' }));
                  }}
                  className={`w-16 py-2.5 rounded-xl border text-sm font-bold transition
                    duration-150 cursor-pointer ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {count}
                </button>
              );
            })}
          </div>
          {errors.numberOfQuestions && (
            <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
              {errors.numberOfQuestions}
            </p>
          )}
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20
          border border-rose-200 dark:border-rose-800 rounded-xl text-sm
          text-rose-700 dark:text-rose-400">
          <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            Questions are generated fresh every session. Answer using the{' '}
            <strong>STAR method</strong> (Situation → Task → Action → Result)
            for the best evaluation scores.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex gap-3">
          <button
            type="button" onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl
              text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50
              dark:hover:bg-gray-800 transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5
              bg-rose-600 hover:bg-rose-700 disabled:opacity-60
              disabled:cursor-not-allowed text-white rounded-xl text-sm
              font-semibold transition duration-150 cursor-pointer"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Generating HR questions…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                Start HR Interview
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateHrInterview;
