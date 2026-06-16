"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "auth/user-not-found") {
          setError("No account found with this email address.");
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid email address.");
        } else if (code === "auth/too-many-requests") {
          setError("Too many requests. Please try again later.");
        } else {
          setError("Failed to send reset email. Please try again.");
        }
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-clay-200 bg-white shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 text-5xl">&#x1F3FA;</div>
        <CardTitle className="text-3xl text-clay-700">
          Reset Password
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {success ? (
            <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
              <p className="font-medium">Check your email!</p>
              <p className="mt-1">
                A password reset link has been sent to{" "}
                <span className="font-medium">{email}</span>. Please check your
                inbox and spam folder.
              </p>
            </div>
          ) : (
            <>
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
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner size="sm" /> : "Send Reset Link"}
              </Button>
            </>
          )}
        </CardContent>
      </form>
      <CardFooter className="justify-center">
        <p className="text-sm text-clay-500">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-clay-700 hover:underline"
          >
            Back to Login
          </Link>
        </p>
      </CardFooter>
      </Card>
    </div>
  );
}
