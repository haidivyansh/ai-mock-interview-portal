import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const EXPERIENCE_LEVELS = [
  'Entry Level (0-2 yrs)',
  'Mid Level (2-5 yrs)',
  'Senior Level (5+ yrs)',
  'Lead / Manager',
];

const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

const QUESTION_COUNTS = [3, 5, 7, 10];

const validate = ({ jobRole, skills, experienceLevel, difficulty, numberOfQuestions }) => {
  const errors = {};

  if (!jobRole.trim()) {
    errors.jobRole = 'Job role is required.';
  } else if (jobRole.trim().length < 2) {
    errors.jobRole = 'Job role must be at least 2 characters.';
  }

  const skillList = skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (skillList.length === 0) {
    errors.skills = 'Please enter at least one skill.';
  } else if (skillList.some((s) => s.length < 2)) {
    errors.skills = 'Each skill must be at least 2 characters.';
  }

  if (!experienceLevel) {
    errors.experienceLevel = 'Please select an experience level.';
  }

  if (!difficulty) {
    errors.difficulty = 'Please select a difficulty level.';
  }

  if (!numberOfQuestions) {
    errors.numberOfQuestions = 'Please select the number of questions.';
  }

  return errors;
};

const CreateInterview = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    jobRole: '',
    skills: '',
    experienceLevel: '',
    difficulty: '',
    numberOfQuestions: '',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
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
      const skillsArray = form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { data } = await api.post('/interview/create', {
        jobRole: form.jobRole.trim(),
        skills: skillsArray,
        experienceLevel: form.experienceLevel,
        difficulty: form.difficulty,
        numberOfQuestions: parseInt(form.numberOfQuestions, 10),
      });

      navigate(`/interview/${data.interview.id}`);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Something went wrong. Please try again.';
      // Surface field-level errors returned from the server
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
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-150';
  const inputNormal =
    'border-gray-300 dark:border-gray-700 focus:ring-purple-500 focus:border-purple-500';
  const inputError =
    'border-red-400 dark:border-red-500 focus:ring-red-400 focus:border-red-400';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <span className="px-3 py-1 text-xs font-semibold tracking-wider text-purple-600 uppercase bg-purple-100 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
          New Session
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Create Mock Interview
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Fill in the details below and we'll generate a tailored set of interview questions for you.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
      >
        {/* Server-level error */}
        {serverError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.293 4.293a1 1 0 011.414 0L21 13.586V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-5.414l9.293-9.293z" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        {/* Job Role */}
        <div>
          <label
            htmlFor="jobRole"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Job Role <span className="text-red-500">*</span>
          </label>
          <input
            id="jobRole"
            name="jobRole"
            type="text"
            value={form.jobRole}
            onChange={handleChange}
            placeholder="e.g. Full-Stack Developer, Data Scientist"
            className={`${inputBase} ${errors.jobRole ? inputError : inputNormal}`}
            aria-describedby={errors.jobRole ? 'jobRole-error' : undefined}
            aria-invalid={!!errors.jobRole}
          />
          {errors.jobRole && (
            <p id="jobRole-error" className="mt-1.5 text-xs text-red-500 dark:text-red-400">
              {errors.jobRole}
            </p>
          )}
        </div>

        {/* Skills */}
        <div>
          <label
            htmlFor="skills"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Skills <span className="text-red-500">*</span>
          </label>
          <input
            id="skills"
            name="skills"
            type="text"
            value={form.skills}
            onChange={handleChange}
            placeholder="e.g. React, Node.js, MongoDB (comma-separated)"
            className={`${inputBase} ${errors.skills ? inputError : inputNormal}`}
            aria-describedby={errors.skills ? 'skills-error' : 'skills-hint'}
            aria-invalid={!!errors.skills}
          />
          {errors.skills ? (
            <p id="skills-error" className="mt-1.5 text-xs text-red-500 dark:text-red-400">
              {errors.skills}
            </p>
          ) : (
            <p id="skills-hint" className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Separate multiple skills with commas.
            </p>
          )}
        </div>

        {/* Experience Level */}
        <div>
          <label
            htmlFor="experienceLevel"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Experience Level <span className="text-red-500">*</span>
          </label>
          <select
            id="experienceLevel"
            name="experienceLevel"
            value={form.experienceLevel}
            onChange={handleChange}
            className={`${inputBase} ${errors.experienceLevel ? inputError : inputNormal}`}
            aria-describedby={errors.experienceLevel ? 'experienceLevel-error' : undefined}
            aria-invalid={!!errors.experienceLevel}
          >
            <option value="">Select experience level</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {errors.experienceLevel && (
            <p id="experienceLevel-error" className="mt-1.5 text-xs text-red-500 dark:text-red-400">
              {errors.experienceLevel}
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div>
          <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Difficulty <span className="text-red-500">*</span>
          </span>
          <div className="flex gap-3" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTY_LEVELS.map((level) => {
              const colorMap = {
                Easy: {
                  active: 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400',
                  idle: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                },
                Medium: {
                  active: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
                  idle: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                },
                Hard: {
                  active: 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400',
                  idle: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                },
              };
              const isSelected = form.difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, difficulty: level }));
                    if (errors.difficulty) setErrors((prev) => ({ ...prev, difficulty: '' }));
                  }}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition duration-150 cursor-pointer ${
                    isSelected ? colorMap[level].active : colorMap[level].idle
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
          {errors.difficulty && (
            <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.difficulty}</p>
          )}
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
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, numberOfQuestions: String(count) }));
                    if (errors.numberOfQuestions)
                      setErrors((prev) => ({ ...prev, numberOfQuestions: '' }));
                  }}
                  className={`w-16 py-2.5 rounded-xl border text-sm font-bold transition duration-150 cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400'
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

        {/* Submit */}
        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition duration-150 cursor-pointer"
          >
            {submitting ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Generating Interview...
              </>
            ) : (
              <>
                Generate Interview
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInterview;
