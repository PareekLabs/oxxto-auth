'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/lib/useTheme';
import styles from './login.module.css';

// Type declaration for Google Identity Services
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (element: HTMLElement, config: any) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

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

    const handleGoogleLogin = async (idToken: string) => {
        setError('');
        setLoading(true);
        try {
            if (codeChallenge && codeChallengeMethod) {
                // ── PKCE Authorization Code Flow for Google ──────────────────────
                const response = await fetch(`${API_URL}/auth/v1/authorize/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idToken,
                        redirectUri,
                        codeChallenge,
                        codeChallengeMethod,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || data.error || 'Google login failed');
                }

                // Redirect to the URL which contains the ?code=...
                window.location.href = data.redirectUrl;
                return;
            }

            // ── Standard Token Flow for Google ──────────────────────
            const response = await fetch(`${API_URL}/auth/v1/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Google login failed');
            }

            const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

            if (isDesktop && !redirectUri) {
                // Web app flow — redirect with tokens
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);
                    window.location.href = process.env.NEXT_PUBLIC_REDIRECT_URI || 'https://crm.oxxto.com/auth-callback';
                }
            } else if (redirectUri) {
                // Mobile deep link or Flutter web callback
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                window.location.href = `${redirectUri}?token=${data.accessToken}&refreshToken=${data.refreshToken}`;
            } else {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                window.location.href = `https://crm.oxxto.com/#/auth-callback?token=${data.accessToken}&refreshToken=${data.refreshToken}`;
            }
        } catch (err: any) {
            setError(err.message || 'Google login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Load Google Identity Services script
    const googleButtonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if ((window as any).google && googleButtonRef.current) {
                (window as any).google.accounts.id.initialize({
                    client_id: '206451868295-p4uonulqqlt4kqdmqq6mt5jv4vv0eis1.apps.googleusercontent.com',
                    callback: (response: any) => {
                        handleGoogleLogin(response.credential);
                    },
                });
                (window as any).google.accounts.id.renderButton(googleButtonRef.current, {
                    type: 'standard',
                    theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline',
                    size: 'large',
                    width: googleButtonRef.current.offsetWidth,
                    text: 'continue_with',
                    shape: 'pill',
                });
            }
        };
        document.head.appendChild(script);
        return () => {
            document.head.removeChild(script);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

                    <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />

                    <div className={styles.registerLink}>
                        <span>Don&apos;t have an account?</span>
                        <Link href={`/register${redirectUri ? `?redirect_uri=${redirectUri}` : ''}`}>Create account</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
