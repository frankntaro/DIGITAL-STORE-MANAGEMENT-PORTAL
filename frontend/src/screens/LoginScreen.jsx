import React, { useState } from 'react';
import { Eye, EyeOff, Globe, Lock, User } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

export default function LoginScreen({ onLogin, loading, error }) {
  const { lang, toggleLanguage, t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const currentYear = new Date().getFullYear();

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div
      className="min-h-dvh bg-slate-950 bg-cover bg-center bg-no-repeat relative flex items-center justify-center p-3 sm:p-5 md:p-8 safe-area-top safe-area-bottom"
      style={{ backgroundImage: "url('/login-bg.jpeg')" }}
    >
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-white/20">
        {/* Left Hero Showcase Panel */}
        <div className="lg:col-span-6 bg-gradient-to-br from-navy-950/95 via-navy-900/95 to-blue-900/95 text-white p-6 sm:p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-5 sm:mb-6">
              <img
                src="/logo.png"
                alt="KAMPANGO PHONES AND ELECTRONICS"
                width="56"
                height="56"
                fetchPriority="high"
                decoding="async"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shadow-lg border-2 border-white/25 shrink-0"
              />
              <div>
                <span className="text-lg sm:text-xl font-extrabold tracking-tight block leading-tight">
                  KAMPANGO PHONES AND ELECTRONICS
                </span>
                <p className="text-xs text-blue-200 font-medium mt-0.5">
                  {t('Phones, Accessories & Home Electronics POS')}
                </p>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight mb-2 sm:mb-3">
              {t('Smart Management.')} <br />
              <span className="text-blue-400">{t('Better Retail Business.')}</span>
            </h1>
          </div>

          {/* Product Visual Showcase */}
          <div className="my-4 sm:my-6 relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/15 flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=200&q=80"
                alt={t('Smartphones')}
                width="56"
                height="56"
                loading="lazy"
                decoding="async"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover block shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{t('Phones & Accessories')}</p>
                <p className="text-[11px] text-blue-200">{t('Weighted Avg Costing')}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/15 flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=200&q=80"
                alt={t('Speakers & Electronics')}
                width="56"
                height="56"
                loading="lazy"
                decoding="async"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover block shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{t('Speakers, TVs & Solar')}</p>
                <p className="text-[11px] text-blue-200">{t('Warranty & Claims')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign-In Form Card */}
        <div className="lg:col-span-6 p-6 sm:p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-sm mx-auto w-full">
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {t('DIGITAL STORE MANAGEMENT PORTAL')}
              </span>
              <button
                type="button"
                onClick={toggleLanguage}
                title={t('Toggle between English and Kiswahili')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 transition shrink-0"
              >
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'en' ? '🇺🇸 English' : '🇹🇿 Kiswahili'}</span>
              </button>
            </div>

            <div className="text-center lg:text-left mb-7">
              <h2 className="text-2xl font-extrabold text-slate-900">{t('Welcome Back!')}</h2>
              <p className="text-sm text-slate-500 mt-1">{t('Sign in to your account')}</p>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-medium text-red-700">
                {t(error)}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('Username or Email')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('Enter username')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('Password')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Enter password')}
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t('Hide password') : t('Show password')}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label htmlFor="keep-signed-in" className="inline-flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    id="keep-signed-in"
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 accent-blue-600"
                  />
                  <span>{t('Keep me signed in')}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#D07461] hover:bg-[#BA614E] active:bg-[#A65342] disabled:opacity-60 text-white font-semibold text-sm shadow-lg shadow-[#D07461]/30 transition"
              >
                {loading ? t('Signing in...') : t('Sign In')}
              </button>
            </form>

            {/* Footer Attribution */}
            <div className="mt-7 pt-5 border-t border-slate-200 text-center space-y-1">
              <p className="text-xs font-bold text-slate-700">
                {t('Developed by SOFT-LINK Africa Team')}
              </p>
              <p className="text-[11px] text-slate-500">
                {t('© {year} All rights reserved.', { year: currentYear })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
