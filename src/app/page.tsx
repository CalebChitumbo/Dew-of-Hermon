"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/shared/LoadingSpinner";

export default function Home() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (firebaseUser) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [firebaseUser, loading, router]);

  return <PageLoader />;
}
