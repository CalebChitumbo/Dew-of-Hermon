"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="space-y-4">
      <Link
        href="/rops-camp"
        className="group flex items-center justify-between gap-3 rounded-xl border border-clay-200 bg-gradient-to-r from-[#16110D] to-[#2A211A] px-4 py-3 text-left text-cream shadow-sm transition-colors hover:border-[#D14A1F]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Flame
            className="h-5 w-5 text-[#D14A1F] shrink-0"
            fill="currentColor"
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#D14A1F]">
              ROPs X · 2026
            </p>
            <p className="text-sm font-medium text-cream truncate">
              Registering your child for camp?
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-cream shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>
      <Card className="relative overflow-hidden rounded-2xl border-clay-200/60 bg-white/90 shadow-[0_25px_60px_-20px_rgba(91,58,41,0.35)] backdrop-blur-xl">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-light via-gold to-gold-dark"
        />
        <CardHeader className="pt-10 text-center">
          <div className="relative mx-auto mb-5">
            <div
              aria-hidden
              className="absolute inset-0 -m-6 rounded-full bg-gradient-to-br from-gold/20 to-clay-200/30 blur-2xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/church-logo.png"
              alt="Tabernacle of David Assembly — City Mission Church"
              width={240}
              height={182}
              className="relative mx-auto h-auto w-56 max-w-full"
            />
          </div>
          <CardTitle className="font-['Cormorant_Garamond'] italic text-[3rem] font-medium leading-[1.05] tracking-tight text-clay-700">
            Dew of Hermon
          </CardTitle>
          <CardDescription className="text-clay-500">
            Sign in to continue
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 px-8 pb-2">
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                <span className="bg-white px-3 text-clay-400">or</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-lg border-clay-200 transition-colors hover:bg-clay-50"
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
          </CardContent>
        </form>
        <CardFooter className="justify-center px-8 pb-8 pt-4">
          <p className="text-sm text-clay-500">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-clay-700 transition-colors hover:text-gold-dark"
            >
              Create an account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
