"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  const handleRetry = useCallback(() => {
    router.refresh();
    reset();
  }, [router, reset]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="text-5xl mb-4">&#x1F3FA;</div>
          <h2 className="text-xl font-bold text-clay-700 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-clay-500 mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <Button onClick={handleRetry} variant="gold">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
