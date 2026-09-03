import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import useTheme from '../hooks/useTheme';

const INPUT_BASE =
  'w-full px-4 py-3 rounded-xl border text-sm bg-white/80 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition duration-150';
const INPUT_NORMAL =
  'border-gray-200 dark:border-gray-700 focus:ring-purple-500/40 focus:border-purple-500';
const INPUT_ERROR =
  'border-red-400 dark:border-red-500 focus:ring-red-400/40 focus:border-red-500';

const passwordStrength = (pw) => {
  let score = 0;
  if (!pw) return { score: 0, label: '—', color: 'bg-gray-200 dark:bg-gray-700' };
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { label: 'Very Weak', color: 'bg-red-500', w: '20%' },
    { label: 'Weak', color: 'bg-red-400', w: '40%' },
    { label: 'Fair', color: 'bg-amber-500', w: '60%' },
    { label: 'Good', color: 'bg-indigo-500', w: '80%' },
    { label: 'Strong', color: 'bg-green-500', w: '100%' },
  ];
  const idx = Math.min(score, levels.length - 1);
  return { score, ...levels[idx] };
};

const BrandPanel = () => (
  <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-purple-700 via-indigo-700 to-indigo-900 text-white overflow-hidden">
    <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
    <div className="absolute top-1/3 right-10 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl" />

    <div className="relative z-10 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center font-extrabold text-xl">
        I
      </div>
      <div>
        <div className="text-xl font-extrabold tracking-tight">IntervAI</div>
        <div className="text-xs text-white/70">AI Mock Interview Portal</div>
      </div>
    </div>

    <div className="relative z-10 space-y-8 max-w-md">
      <div className="space-y-4">
        <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">
          Ace Your Next Interview with AI Coaching
        </h2>
        <p className="text-base text-white/80 leading-relaxed">
          Real-time mock interviews, tailored questions from your resume or target role,
          and instant AI feedback on your answers. Build confidence the smart way.
        </p>
      </div>

      <ul className="space-y-3 text-sm">
        {[
          'Personalized role-based & resume-based interviews',
          'Live camera + AI voice + speech-to-text',
          'Instant Gemini-powered scoring & feedback',
          'Progress history and improvement trends',
        ].map((f) => (
          <li key={f} className="flex items-start gap-3">
            <div className="mt-0.5 w-5 h-5 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-white/90">{f}</span>
          </li>
        ))}
      </ul>
    </div>

    <p className="relative z-10 text-xs text-white/60">
      © {new Date().getFullYear()} IntervAI. All rights reserved.
    </p>
  </div>
);

const ThemeToggle = () => {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
};

const SubmitButton = ({ submitting, children }) => (
  <button
    type="submit"
    disabled={submitting}
    className="w-full px-5 py-3 font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-indigo-600 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10"
  >
    {submitting && (
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    )}
    {children}
  </button>
);

const FieldError = ({ msg }) => (
  <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 flex items-start gap-1.5">
    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M12 9v2m0 4h.01M10.293 4.293a1 1 0 011.414 0L21 13.586V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-5.414l9.293-9.293z" />
    </svg>
    <span>{msg}</span>
  </p>
);

const AuthPage = () => {
  const [mode, setMode] = useState('login'); // login | register
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotification();

  const from = location.state?.from?.pathname || '/dashboard';

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regErrors, setRegErrors] = useState({});
  const [regSubmitting, setRegSubmitting] = useState(false);

  const pwStrength = useMemo(() => passwordStrength(regPassword), [regPassword]);

  const validateLogin = () => {
    const errs = {};
    if (!loginEmail.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) errs.email = 'Invalid email format';
    if (!loginPassword) errs.password = 'Password is required';
    setLoginErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRegister = () => {
    const errs = {};
    if (!regName.trim()) errs.name = 'Name is required';
    else if (regName.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!regEmail.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) errs.email = 'Invalid email format';

    if (!regPassword) errs.password = 'Password is required';
    else if (regPassword.length < 6) errs.password = 'Password must be at least 6 characters';

    if (!regConfirm) errs.confirm = 'Please confirm your password';
    else if (regPassword !== regConfirm) errs.confirm = 'Passwords do not match';

    setRegErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!validateLogin()) return;

    setLoginSubmitting(true);
    const result = await login(loginEmail.trim(), loginPassword);
    setLoginSubmitting(false);

    if (result.success) {
      notify.success('Welcome Back', 'You have been signed in successfully.');
      navigate(from, { replace: true });
    } else {
      notify.error('Sign In Failed', result.error);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!validateRegister()) return;

    setRegSubmitting(true);
    const result = await register(regName.trim(), regEmail.trim(), regPassword);
    setRegSubmitting(false);

    if (result.success) {
      notify.success('Account Created', `Welcome to IntervAI, ${regName.split(' ')[0]}!`);
      navigate('/dashboard', { replace: true });
    } else {
      notify.error('Registration Failed', result.error);
    }
  };

  const switchMode = (next) => {
    setMode(next);
  };

  const LogoHeader = () => (
    <div className="lg:hidden flex items-center justify-between mb-8">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold">
          I
        </div>
        <div>
          <div className="font-extrabold tracking-tight text-gray-900 dark:text-white">IntervAI</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">AI Mock Interview Portal</div>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );

  const Tabs = () => (
    <div className="relative p-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 grid grid-cols-2 mb-7">
      <div
        className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-white dark:bg-gray-900 shadow-sm transition-transform duration-200 ease-out ${
          mode === 'login' ? 'translate-x-0' : 'translate-x-[calc(100%+6px)]'
        }`}
      />
      <button
        type="button"
        onClick={() => switchMode('login')}
        className={`relative z-10 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
          mode === 'login' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => switchMode('register')}
        className={`relative z-10 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
          mode === 'register' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        Create Account
      </button>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex bg-gray-50 dark:bg-gray-950">
      <BrandPanel />

      <div className="flex-1 flex flex-col min-h-screen relative">
        <div className="hidden lg:flex absolute top-6 right-6 z-10">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md animate-fadeIn">
            <LogoHeader />

            <div className="mb-6">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {mode === 'login'
                  ? 'Sign in to continue your interview prep.'
                  : 'Start your AI-powered interview journey in seconds.'}
              </p>
            </div>

            <Tabs />

            {/* Login form */}
            <form
              key="login-form"
              onSubmit={handleLoginSubmit}
              noValidate
              className={`space-y-5 ${mode === 'login' ? 'animate-fadeIn' : 'hidden'}`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (loginErrors.email) setLoginErrors((p) => ({ ...p, email: '' }));
                  }}
                  placeholder="you@example.com"
                  className={`${INPUT_BASE} ${loginErrors.email ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {loginErrors.email && <FieldError msg={loginErrors.email} />}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginErrors.password) setLoginErrors((p) => ({ ...p, password: '' }));
                    }}
                    placeholder="••••••••"
                    className={`${INPUT_BASE} ${loginErrors.password ? INPUT_ERROR : INPUT_NORMAL} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                    tabIndex={-1}
                    aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPw ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {loginErrors.password && <FieldError msg={loginErrors.password} />}
              </div>

              <SubmitButton submitting={loginSubmitting}>
                {loginSubmitting ? 'Signing you in...' : 'Sign In'}
              </SubmitButton>

              <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-1">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 cursor-pointer"
                >
                  Sign up
                </button>
              </div>
            </form>

            {/* Register form */}
            <form
              key="register-form"
              onSubmit={handleRegisterSubmit}
              noValidate
              className={`space-y-4 ${mode === 'register' ? 'animate-fadeIn' : 'hidden'}`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    if (regErrors.name) setRegErrors((p) => ({ ...p, name: '' }));
                  }}
                  placeholder="John Doe"
                  className={`${INPUT_BASE} ${regErrors.name ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {regErrors.name && <FieldError msg={regErrors.name} />}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    if (regErrors.email) setRegErrors((p) => ({ ...p, email: '' }));
                  }}
                  placeholder="you@example.com"
                  className={`${INPUT_BASE} ${regErrors.email ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {regErrors.email && <FieldError msg={regErrors.email} />}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => {
                    setRegPassword(e.target.value);
                    if (regErrors.password) setRegErrors((p) => ({ ...p, password: '' }));
                  }}
                  placeholder="••••••••"
                  className={`${INPUT_BASE} ${regErrors.password ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {regPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Password strength</span>
                      <span
                        className={`font-semibold ${
                          pwStrength.score <= 1
                            ? 'text-red-500'
                            : pwStrength.score <= 2
                            ? 'text-amber-500'
                            : pwStrength.score <= 3
                            ? 'text-indigo-500'
                            : 'text-green-500'
                        }`}
                      >
                        {pwStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`}
                        style={{ width: pwStrength.w }}
                      />
                    </div>
                  </div>
                )}
                {regErrors.password && <FieldError msg={regErrors.password} />}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={regConfirm}
                  onChange={(e) => {
                    setRegConfirm(e.target.value);
                    if (regErrors.confirm) setRegErrors((p) => ({ ...p, confirm: '' }));
                  }}
                  placeholder="••••••••"
                  className={`${INPUT_BASE} ${regErrors.confirm ? INPUT_ERROR : INPUT_NORMAL}`}
                />
                {regErrors.confirm && <FieldError msg={regErrors.confirm} />}
              </div>

              <div className="pt-1">
                <SubmitButton submitting={regSubmitting}>
                  {regSubmitting ? 'Creating your account...' : 'Create Account'}
                </SubmitButton>
              </div>

              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </form>

            <p className="mt-8 text-center text-[11px] text-gray-400 dark:text-gray-600">
              By continuing you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>

        <div className="py-5 text-center text-xs text-gray-400 dark:text-gray-600 lg:hidden">
          © {new Date().getFullYear()} IntervAI. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
