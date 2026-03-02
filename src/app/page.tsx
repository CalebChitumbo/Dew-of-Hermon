"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/shared/LoadingSpinner";

export default function Home() {
  const { firebaseUser, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !error) {
      if (firebaseUser) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [firebaseUser, loading, error, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#x1F3FA;</div>
          <h1 className="text-2xl font-display font-bold text-clay-700 mb-2">
            Potter&apos;s Wheel
          </h1>
          <p className="text-sm text-clay-500 mb-4">
            Unable to connect to the service. Please try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-clay-700 text-cream rounded-md px-4 py-2 text-sm font-medium hover:bg-clay-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <PageLoader />;
}
