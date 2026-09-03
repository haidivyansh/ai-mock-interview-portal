import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const Profile = () => {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const notify = useNotification();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const validateProfile = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validatePassword = () => {
    const errs = {};
    if (!newPassword) {
      errs.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      errs.newPassword = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!validateProfile()) return;

    setIsSubmitting(true);
    const result = await updateProfile({ name, email });
    setIsSubmitting(false);

    if (result.success) {
      notify.success('Profile Updated', 'Your profile has been saved successfully.');
    } else {
      notify.error('Update Failed', result.error);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setIsPasswordSubmitting(true);
    const result = await updateProfile({ password: newPassword });
    setIsPasswordSubmitting(false);

    if (result.success) {
      notify.success('Password Changed', 'Your password has been updated.');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      notify.error('Password Update Failed', result.error);
    }
  };

  const inputBase =
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition duration-150';
  const inputNormal =
    'border-gray-300 dark:border-gray-700 focus:ring-purple-500 focus:border-purple-500';
  const inputError =
    'border-red-400 dark:border-red-500 focus:ring-red-400 focus:border-red-400';

  const handleLogout = () => {
    logout();
    notify.info('Logged Out', 'You have been signed out.');
    navigate('/login', { replace: true });
  };

  const getInitials = (n) => {
    if (!n) return '?';
    return n
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fadeIn space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="px-3 py-1 text-xs font-semibold tracking-wider text-purple-600 uppercase bg-purple-100 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
            Account Settings
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Your Profile
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Manage your account details and password.
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

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-purple-600 to-indigo-600" />
        <div className="px-6 pb-6 -mt-14 relative z-10">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-28 h-28 rounded-2xl bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-md flex items-center justify-center text-3xl font-extrabold text-purple-600 dark:text-purple-400">
              {getInitials(user?.name)}
            </div>
            <div className="pb-2 min-w-0">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white truncate">
                {user?.name || 'User'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Account ID: {user?.id?.slice(0, 14)}
                {user?.id?.length > 14 ? '…' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal info */}
        <form
          onSubmit={handleProfileSubmit}
          noValidate
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-5"
        >
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Personal Information</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Update your name and email address.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: '' }));
              }}
              className={`${inputBase} ${errors.name ? inputError : inputNormal}`}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: '' }));
              }}
              className={`${inputBase} ${errors.email ? inputError : inputNormal}`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.email}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </form>

        {/* Password */}
        <form
          onSubmit={handlePasswordSubmit}
          noValidate
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-5"
        >
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change Password</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose a strong password to keep your account secure.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: '' }));
              }}
              className={`${inputBase} ${errors.newPassword ? inputError : inputNormal}`}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {errors.newPassword && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
              className={`${inputBase} ${errors.confirmPassword ? inputError : inputNormal}`}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPasswordSubmitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            {isPasswordSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-2xl shadow-sm p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sign Out</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              End your current session on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
