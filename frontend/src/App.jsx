import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import InterviewSession from './components/InterviewSession';
import CreateInterview from './components/CreateInterview';
import InterviewDetail from './components/InterviewDetail';
import CreateResumeInterview from './components/CreateResumeInterview';
import CreateHrInterview from './components/CreateHrInterview';
import ResumeInterviewDetail from './components/ResumeInterviewDetail';
import InterviewHistory from './components/InterviewHistory';
import Profile from './components/Profile';
import useTheme from './hooks/useTheme';

function Header() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const notify = useNotification();
  const handleLogout = () => {
    logout();
    notify.info('Logged Out', 'You have been signed out.');
  };

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold">I</span>
          <span className="hidden sm:inline">IntervAI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link to="/dashboard" className="font-medium text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors">Dashboard</Link>
          <Link to="/history" className="font-medium text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors">History</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/profile"
            title="Profile"
            aria-label="Profile"
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center text-xs font-extrabold text-purple-700 dark:text-purple-300 hover:border-purple-400 transition-colors shrink-0"
          >
            {user?.name
              ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
              : '?'}
          </Link>

          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="px-3 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Out</span>
          </button>

          <button
            onClick={toggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer shrink-0"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-6 bg-white dark:bg-gray-900 text-center text-sm text-gray-500 dark:text-gray-400">
      <p>&copy; {new Date().getFullYear()} IntervAI. All rights reserved.</p>
    </footer>
  );
}

function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {user && <Header />}
      <main className="flex-1 flex flex-col">
        <Routes>
          {/* Landing: redirect to login for unauthenticated, dashboard for authenticated */}
          <Route path="/" element={<RootRedirect />} />

          {/* Auth routes — reverse protected: logged-in users can't visit */}
          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <AuthPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute requireAuth={false}>
                <AuthPage />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <InterviewHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-interview"
            element={
              <ProtectedRoute>
                <CreateInterview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/:id"
            element={
              <ProtectedRoute>
                <InterviewSession />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview-detail/:id"
            element={
              <ProtectedRoute>
                <InterviewDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-resume-interview"
            element={
              <ProtectedRoute>
                <CreateResumeInterview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-hr-interview"
            element={
              <ProtectedRoute>
                <CreateHrInterview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resume-interview-detail/:id"
            element={
              <ProtectedRoute>
                <ResumeInterviewDetail />
              </ProtectedRoute>
            }
          />

          {/* 404 Catch-all — redirect to login (or dashboard if logged in) */}
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </main>
      {user && <Footer />}
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function NotFoundRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppLayout />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
