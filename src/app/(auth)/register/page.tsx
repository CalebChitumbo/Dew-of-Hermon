"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDocs, query, orderBy } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { LifeGroup, Institution } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

const LIFE_GROUP_LABELS: Record<LifeGroup, string> = {
  BRIDGE: "Bridge (15-20 years)",
  ANCHOR: "Anchor (21-25 years)",
  CORNERSTONE: "Cornerstone (26+ years)",
};

const DEFAULT_INSTITUTIONS: Institution[] = [
  { id: "unza", name: "UNZA", isActive: true, order: 1, createdAt: new Date() },
  { id: "texila", name: "Texila American University", isActive: true, order: 2, createdAt: new Date() },
  { id: "evelyn-hone", name: "Evelyn Hone College", isActive: true, order: 3, createdAt: new Date() },
  { id: "apex", name: "Apex Medical University", isActive: true, order: 4, createdAt: new Date() },
  { id: "nipa", name: "NIPA", isActive: true, order: 5, createdAt: new Date() },
  { id: "zcas", name: "ZCAS University", isActive: true, order: 6, createdAt: new Date() },
  { id: "chreso", name: "Chreso University", isActive: true, order: 7, createdAt: new Date() },
  { id: "cavendish", name: "Cavendish University", isActive: true, order: 8, createdAt: new Date() },
  { id: "eden", name: "Eden University", isActive: true, order: 9, createdAt: new Date() },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const prefillEmail = searchParams.get("email") || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [lifeGroup, setLifeGroup] = useState<LifeGroup | "">("");
  const [isStudent, setIsStudent] = useState(false);
  const [institutionId, setInstitutionId] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();

  const isSafeNext = nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//");
  const postAuthRedirect = isSafeNext ? nextUrl : "/dashboard";

  useEffect(() => {
    async function fetchInstitutions() {
      try {
        const q = query(
          safeCollection("institutions"),
          orderBy("order")
        );
        const snapshot = await getDocs(q);
        const fetched: Institution[] = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.isActive !== false) {
            fetched.push({
              id: doc.id,
              name: data.name,
              isActive: data.isActive ?? true,
              order: data.order || 0,
              createdAt: data.createdAt?.toDate?.() || new Date(),
            });
          }
        });
        setInstitutions(fetched.length > 0 ? fetched : DEFAULT_INSTITUTIONS);
      } catch (error) {
        console.error("Error fetching institutions:", error);
        setInstitutions(DEFAULT_INSTITUTIONS);
      } finally {
        setInstitutionsLoading(false);
      }
    }
    fetchInstitutions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (isStudent && !institutionId) {
      setError("Please select your campus so you appear under it on the register");
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, name, {
        lifeGroup: lifeGroup || undefined,
        isStudent,
        institutionId: isStudent ? institutionId || undefined : undefined,
      });
      router.push(postAuthRedirect);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create account";
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
      router.push(postAuthRedirect);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in with Google";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-clay-200 shadow-lg">
      <CardHeader className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/church-logo.png"
          alt="Tabernacle of David Assembly — City Mission Church"
          width={240}
          height={182}
          className="mx-auto mb-4 h-auto w-60 max-w-full"
        />
        <CardTitle className="text-3xl text-clay-700">Join Dew of Hermon</CardTitle>
        <CardDescription>
          Create your account to get started
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Life Group Selection */}
          <div className="space-y-2">
            <Label htmlFor="lifeGroup">Life Group</Label>
            <Select
              value={lifeGroup}
              onValueChange={(value) => setLifeGroup(value as LifeGroup)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your Life Group" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LIFE_GROUP_LABELS) as LifeGroup[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {LIFE_GROUP_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label htmlFor="isStudent" className="cursor-pointer">
                Are you a student?
              </Label>
              <button
                type="button"
                role="switch"
                aria-checked={isStudent}
                onClick={() => {
                  setIsStudent(!isStudent);
                  if (isStudent) setInstitutionId("");
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isStudent ? "bg-gold" : "bg-clay-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isStudent ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Institution Dropdown (shown only if student) */}
          {isStudent && (
            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Select
                value={institutionId}
                onValueChange={setInstitutionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={institutionsLoading ? "Loading institutions..." : "Select your institution"} />
                </SelectTrigger>
                <SelectContent>
                  {institutionsLoading ? (
                    <SelectItem value="__loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : institutions.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      No institutions available
                    </SelectItem>
                  ) : (
                    institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" /> : "Create Account"}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-clay-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-clay-400">
                Or continue with
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
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
            Google
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center">
        <p className="text-sm text-clay-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-clay-700 hover:underline">
            Sign In
          </Link>
        </p>
      </CardFooter>
      </Card>
    </div>
  );
}
