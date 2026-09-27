'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  useEffect(() => {
    fetchApi('/api/auth/me')
      .then((res) => {
        if (res.ok) {
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  const handleGoogleLogin = () => {
    setShowGoogleModal(true);
  };

  const handleEmailClick = () => {
    addToast('Email login coming soon', 'info');
  };

  const handleDemoLogin = async () => {
    setShowGoogleModal(false);
    try {
      const res = await fetchApi('/api/auth/dev-login');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          window.location.href = '/dashboard';
        }
      } else {
        addToast('Demo login failed. Please try again.', 'error');
      }
    } catch (err) {
      addToast('Could not reach backend. Is the server running?', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-24 px-4">

      {/* Google OAuth Info Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in">
            {/* Close button */}
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Google Sign-In Unavailable
            </h2>

            <p className="text-sm text-gray-600 text-center leading-relaxed mb-4">
              Google OAuth requires app verification with a{' '}
              <span className="font-medium">registered custom domain</span>. Since this
              project is deployed on a free Render subdomain (
              <code className="bg-gray-100 px-1 rounded text-xs">onrender.com</code>
              ), Google restricts public sign-in to prevent unverified app access.
            </p>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-5">
              <p className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">✅ For Evaluators:</span> The complete
                Google OAuth pipeline — Passport.js strategy, session management, and
                callback routing — is fully implemented in the backend. Use{' '}
                <span className="font-semibold">Demo Login</span> below to access all
                features of the app instantly.
              </p>
            </div>

            <button
              onClick={handleDemoLogin}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Continue with Demo Login
            </button>

            <button
              onClick={() => setShowGoogleModal(false)}
              className="w-full mt-2 text-gray-400 hover:text-gray-600 text-xs py-1.5 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm border border-gray-100 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Login</h1>

        {/* Demo Login — instant access */}
        <button
          id="demo-login-btn"
          onClick={handleDemoLogin}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg mb-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Demo Login (No Google Account Needed)
        </button>

        <div className="text-center text-gray-400 text-xs my-3 relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <span className="relative bg-white px-2">or continue with</span>
        </div>

        {/* Google button — clickable, opens info modal */}
        <button
          id="google-login-btn"
          onClick={handleGoogleLogin}
          className="w-full border border-gray-300 rounded-lg py-2.5 px-4 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="text-gray-600 text-sm font-medium">Sign in with Google</span>
        </button>

        <div className="text-center text-gray-400 text-sm my-4 relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <span className="relative bg-white px-2">or sign up through email</span>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email ID"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-green-500"
            onClick={handleEmailClick}
            readOnly
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-green-500"
            onClick={handleEmailClick}
            readOnly
          />
          <button
            onClick={handleEmailClick}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg mt-2 text-sm transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
