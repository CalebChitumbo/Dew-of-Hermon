"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-cream">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg border border-clay-200 shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">&#x1F3FA;</div>
            <h2 className="text-xl font-bold text-clay-700 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-clay-500 mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-md bg-clay-700 px-4 py-2 text-sm font-medium text-white hover:bg-clay-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
