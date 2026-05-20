"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Flame, ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsLoading(true);

    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in with Google";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      {/* Brand / hero panel */}
      <aside className="relative isolate overflow-hidden bg-gradient-to-br from-[#1a0d05] via-clay-900 to-[#2A1810] text-cream">
        {/* Ambient color washes */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-gold/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#B85A1E]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(200,150,62,0.12),transparent_55%),radial-gradient(circle_at_85%_85%,rgba(184,90,30,0.12),transparent_55%)]"
        />
        {/* Subtle grid texture */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full text-cream opacity-[0.035]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="brand-grid"
              width="44"
              height="44"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 44 0 L 0 0 0 44"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#brand-grid)" />
        </svg>
        {/* Top accent line */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
        />

        <div className="relative flex min-h-[44vh] flex-col px-6 py-8 sm:px-10 sm:py-10 lg:min-h-screen lg:px-14 lg:py-12 xl:px-20">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/church-logo.png"
              alt="Tabernacle of David Assembly"
              width={56}
              height={56}
              className="h-11 w-auto opacity-95"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/85">
                Tabernacle of David
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cream/55">
                City Mission Church
              </span>
            </div>
          </div>

          {/* Hero */}
          <div className="flex flex-1 flex-col justify-center py-10 lg:py-14">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-cream/15 bg-cream/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-light backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-light shadow-[0_0_8px_rgba(224,184,114,0.8)]" />
              A community in worship
            </span>
            <h1 className="mt-5 font-['Cinzel'] text-[2.75rem] font-semibold leading-[0.95] tracking-[0.015em] sm:text-[3.75rem] lg:text-[4.25rem] xl:text-[5rem]">
              Dew of
              <br />
              <span className="bg-gradient-to-br from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">
                Hermon
              </span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] italic leading-relaxed text-cream/75 lg:text-base">
              &ldquo;As the dew of Hermon, that descended upon the mountains of
              Zion: for there the Lord commanded the blessing, even life
              forevermore.&rdquo;
            </p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-light/80">
              — Psalm 133:3
            </p>
          </div>

          {/* Open Now strip */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/80">
                  Open Now
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cream/45">
                No sign-in needed
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/fundraising/order"
                className="group relative flex h-32 items-stretch overflow-hidden rounded-2xl border border-cream/10 bg-cream/[0.04] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[#B85A1E]/60 hover:bg-cream/[0.08] hover:shadow-xl hover:shadow-black/40"
              >
                <div className="relative h-full w-32 shrink-0 overflow-hidden bg-clay-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/login-features/potters-shockers.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent to-[#1a0d05]/70"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#B85A1E] to-[#E8AA73]"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#E8AA73]">
                      <Flame className="h-3 w-3" fill="currentColor" />
                      Potter&apos;s Shockers
                    </p>
                    <p className="mt-1.5 text-sm font-semibold leading-tight text-cream">
                      Sunday Braai pre-orders
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-cream/60">
                      Order ahead for this Sunday&apos;s fundraiser
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-cream/45 transition-all group-hover:translate-x-0.5 group-hover:text-[#E8AA73]" />
                </div>
              </Link>
              <Link
                href="/rops-camp"
                className="group relative flex h-32 items-stretch overflow-hidden rounded-2xl border border-cream/10 bg-cream/[0.04] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[#D14A1F]/60 hover:bg-cream/[0.08] hover:shadow-xl hover:shadow-black/40"
              >
                <div className="relative h-full w-32 shrink-0 overflow-hidden bg-clay-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/login-features/rops-camp.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent to-[#1a0d05]/70"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D14A1F] to-[#F1956C]"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#F1956C]">
                      <Flame className="h-3 w-3" fill="currentColor" />
                      ROPs X · 2026
                    </p>
                    <p className="mt-1.5 text-sm font-semibold leading-tight text-cream">
                      Register your child for camp
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-cream/60">
                      Registration is now open
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-cream/45 transition-all group-hover:translate-x-0.5 group-hover:text-[#F1956C]" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Login panel */}
      <main className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="text-center lg:text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-dark">
              Welcome back
            </p>
            <h2 className="mt-2 font-['Cinzel'] text-[2rem] font-semibold leading-tight tracking-[0.02em] text-clay-800">
              Sign in to continue
            </h2>
            <p className="mt-2 text-sm text-clay-500">
              Pick up where you left off and join the gathering.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-clay-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-lg pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-clay-700">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-clay-500 transition-colors hover:text-gold-dark"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-lg pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-clay-400 transition-colors hover:text-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="group h-11 w-full rounded-lg shadow-md shadow-clay-700/20 transition-all hover:shadow-lg hover:shadow-clay-700/30"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t border-clay-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-[0.18em]">
                <span className="bg-cream px-3 text-clay-400">or</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-lg border-clay-200 bg-white transition-colors hover:bg-clay-50"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-clay-500 lg:text-left">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-clay-800 transition-colors hover:text-gold-dark"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
