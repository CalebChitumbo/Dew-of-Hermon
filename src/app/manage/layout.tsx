"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push("/login");
    }
  }, [firebaseUser, loading, router]);

  if (loading) return <PageLoader />;
  if (!firebaseUser) return null;

  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <Header />
      <main className="lg:pl-64 pb-20 lg:pb-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
