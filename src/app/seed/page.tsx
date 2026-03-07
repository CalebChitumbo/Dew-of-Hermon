"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

export default function SeedPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState("");

  const runSeed = async () => {
    setStatus("loading");
    setResults([]);
    setError("");

    try {
      // Get a fresh ID token from Firebase Auth client
      const user = auth.currentUser;
      if (!user) {
        setStatus("error");
        setError("You must be logged in. Please log in and try again.");
        return;
      }
      const idToken = await user.getIdToken(true);

      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Something went wrong");
        return;
      }

      setStatus("success");
      setResults(data.results || []);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Network error");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%", padding: 32, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Setup Potter&apos;s Wheel</h1>
        <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
          This will populate the database with departments, service roles, and checklist templates.
          It will also upgrade your account to Super Admin.
        </p>

        {status === "idle" && (
          <button
            onClick={runSeed}
            style={{ width: "100%", padding: "12px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Initialize App Data
          </button>
        )}

        {status === "loading" && (
          <div style={{ textAlign: "center", padding: 16, color: "#6b7280" }}>
            Setting up... please wait.
          </div>
        )}

        {status === "success" && (
          <div>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: "#166534", marginBottom: 8 }}>Setup complete!</p>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#166534", fontSize: 14, lineHeight: 1.8 }}>
                {results.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <a
              href="/dashboard"
              style={{ display: "block", textAlign: "center", width: "100%", padding: "12px 24px", background: "#2563eb", color: "white", borderRadius: 8, fontSize: 16, fontWeight: 600, textDecoration: "none" }}
            >
              Go to Dashboard
            </a>
          </div>
        )}

        {status === "error" && (
          <div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: "#991b1b" }}>Error: {error}</p>
            </div>
            <button
              onClick={runSeed}
              style={{ width: "100%", padding: "12px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
