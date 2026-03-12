'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/lib/useTheme';
import styles from '../login/login.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oxxto.com';

import { useSearchParams } from 'next/navigation';

export default function RegisterPage() {
    return (
        <Suspense>
            <RegisterPageContent />
        </Suspense>
    );
}

function RegisterPageContent() {
    const searchParams = useSearchParams();
    const redirectUri = searchParams.get('redirect_uri');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');
    const { theme, mounted } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!termsAccepted) {
            setError('Please accept the terms and conditions');
            return;
        }

        if (!name) {
            setError('Please enter your full name.');
            return;
        }

        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        // Anchored RFC 5322 compatible email validation (prevents partial matches)
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

        if (!email.includes('@')) {
            setError(`Please include an '\u0040' in the email address. '${email.trim()}' is missing an '\u0040'.`);
            return;
        } else if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address (e.g. you@example.com).');
            return;
        }

        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            // Step 1: Create the account
            const registerResponse = await fetch(`${API_URL}/auth/v1/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: name,
                    email,
                    password,
                    organizationName: name + "'s Organization",
                }),
            });

            const registerData = await registerResponse.json();

            if (!registerResponse.ok) {
                throw new Error(registerData.message || registerData.error || 'Registration failed');
            }

            // Step 2: Authorize — same as login, get the auth code redirect URL
            const authorizeResponse = await fetch(`${API_URL}/auth/v1/authorize`, {
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

            const authorizeData = await authorizeResponse.json();

            if (!authorizeResponse.ok) {
                throw new Error(authorizeData.message || authorizeData.error || 'Authorization failed');
            }

            // Navigate to the redirect URL containing ?code=...
            window.location.href = authorizeData.redirectUrl;

        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRegister = async (idToken: string) => {
        setError('');
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/v1/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Google signup failed');
            }

            // Store tokens and redirect
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);

            if (redirectUri) {
                window.location.href = `${redirectUri}?token=${data.accessToken}&refreshToken=${data.refreshToken}`;
            } else {
                window.location.href = `https://crm.oxxto.com/#/auth-callback?token=${data.accessToken}&refreshToken=${data.refreshToken}`;
            }
        } catch (err: any) {
            setError(err.message || 'Google signup failed. Please try again.');
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
                        handleGoogleRegister(response.credential);
                    },
                });
                (window as any).google.accounts.id.renderButton(googleButtonRef.current, {
                    type: 'standard',
                    theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline',
                    size: 'large',
                    width: googleButtonRef.current.offsetWidth,
                    text: 'signup_with',
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

                    <h1 className={styles.title}>Create account</h1>
                    <p className={styles.subtitle}>Start your free trial today</p>
                </div>

                <div className={styles.rightColumn}>
                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form} noValidate>
                        <div className={styles.field}>
                            <label htmlFor="name" className={styles.label}>Full Name</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                className={styles.input}
                                required
                                autoComplete="name"
                            />
                        </div>

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
                                    minLength={6}
                                    autoComplete="new-password"
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

                        <div className={styles.checkbox}>
                            <input
                                id="terms"
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={(e) => setTermsAccepted(e.target.checked)}
                            />
                            <label htmlFor="terms">
                                I agree to the <Link href="https://www.oxxto.com/terms" target="_blank" rel="noopener noreferrer">Terms</Link> and{' '}
                                <Link href="https://www.oxxto.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Create account'}
                        </button>
                    </form>

                    <div className={styles.divider}>
                        <span>or</span>
                    </div>

                    <div ref={googleButtonRef} className={styles.googleButton} style={{ display: 'flex', justifyContent: 'center' }} />

                    <div className={styles.registerLink}>
                        <span>Already have an account?</span>
                        <Link href={`/login${redirectUri ? `?redirect_uri=${redirectUri}` : ''}`}>Sign in instead</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
