'use client';

import { useState, Suspense } from 'react';
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

    const handleGoogleRegister = () => {
        // TODO: Implement Google OAuth flow
        alert('Google signup coming soon!');
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

                    <button
                        type="button"
                        className={styles.googleButton}
                        onClick={handleGoogleRegister}
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
                        <span>Already have an account?</span>
                        <Link href={`/login${redirectUri ? `?redirect_uri=${redirectUri}` : ''}`}>Sign in instead</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
