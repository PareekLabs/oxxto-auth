'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/lib/useTheme';
import styles from './login.module.css';

const getApiUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return 'http://localhost:8080';
    }
    return process.env.NEXT_PUBLIC_API_URL || 'https://api.oxxto.com';
};

const API_URL = getApiUrl();

import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
    return (
        <Suspense>
            <LoginPageContent />
        </Suspense>
    );
}

function LoginPageContent() {
    const searchParams = useSearchParams();
    const redirectUri = searchParams.get('redirect_uri');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');
    const { theme, mounted } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        // Anchored RFC 5322 compatible email validation (prevents partial matches)
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

        if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address (e.g. you@example.com).');
            return;
        }

        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setLoading(true);

        try {
            const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches; // Example: consider desktop if width >= 768px

            if (isDesktop && !redirectUri) {
                // ── Web App Flow (Desktop) ───────────────────────────────
                // This flow is for the web app itself, not for external clients.
                // It uses PKCE but with fixed client_id and redirect_uri for the web app.
                const response = await fetch(`${API_URL}/auth/v1/authorize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        clientId: process.env.NEXT_PUBLIC_CLIENT_ID || 'oxxto-web',
                        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'https://crm.oxxto.com/auth-callback',
                        state: 'some-random-state', // TODO: Generate securely
                        codeChallenge: codeChallenge || 'some-default-challenge', // TODO: Generate securely if not present
                        codeChallengeMethod: codeChallengeMethod || 'S256', // TODO: Use S256 if not present
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Login failed');
                }

                // The API returns { redirectUrl: "https://crm.oxxto.com/auth-callback?code=..." }
                window.location.href = data.redirectUrl;

            } else if (codeChallenge && codeChallengeMethod) {
                // ── PKCE Authorization Code Flow (Flutter Web) ──────────────────────
                // Call the new /auth/v1/authorize endpoint which validates credentials,
                // stores the tokens, and returns a redirect URL with a one-time code.
                const response = await fetch(`${API_URL}/auth/v1/authorize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        redirectUri,
                        codeChallenge,
                        codeChallengeMethod,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Login failed');
                }

                // The API returns { redirectUrl: "https://crm.oxxto.com/auth-callback?code=..." }
                window.location.href = data.redirectUrl;
            } else {
                // ── Legacy Token Flow (Mobile: oxxto://callback) ──────────────────
                const response = await fetch(`${API_URL}/auth/v1/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Login failed');
                }

                // Store tokens
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);

                // Redirect with tokens in URL (mobile deep link scheme)
                if (redirectUri) {
                    window.location.href = `${redirectUri}?token=${data.accessToken}&refreshToken=${data.refreshToken}`;
                } else {
                    window.location.href = `https://crm.oxxto.com/#/auth-callback?token=${data.accessToken}&refreshToken=${data.refreshToken}`;
                }
            }
        } catch (err: any) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // TODO: Implement Google OAuth flow
        alert('Google login coming soon!');
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.leftColumn}>
                    {/* Logo */}
                    <div className={styles.logoWrapper}>
                        {mounted && (
                            <Image
                                src={theme === 'dark' ? '/logos/oxxto-dark.png' : '/logos/oxxto-light.png'}
                                alt="oxxto"
                                width={120}
                                height={32}
                                priority
                            />
                        )}
                    </div>

                    <h1 className={styles.title}>Welcome back</h1>
                    <p className={styles.subtitle}>Sign in to continue</p>
                </div>

                <div className={styles.rightColumn}>
                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form} noValidate>
                        <div className={styles.field}>
                            <label htmlFor="email" className={styles.label}>Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className={styles.input}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="password" className={styles.label}>Password</label>
                            <div className={styles.passwordWrapper}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={styles.input}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    onPointerDown={(e) => e.preventDefault()}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <div className={styles.divider}>
                        <span>or</span>
                    </div>

                    <button
                        type="button"
                        className={styles.googleButton}
                        onClick={handleGoogleLogin}
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
                            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" />
                            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" />
                            <path fill="#EA4335" d="M8.98 3.58c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.9z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className={styles.registerLink}>
                        <span>Don&apos;t have an account?</span>
                        <Link href={`/register${redirectUri ? `?redirect_uri=${redirectUri}` : ''}`}>Create account</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
