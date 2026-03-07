"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onSnapshot, query, orderBy, where, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Service, AppEvent } from "@/types";

interface ServiceOption {
  id: string;
  label: string;
}

function CreateAffirmationForm() {
  const { userData, firebaseUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load recent services for linking
  useEffect(() => {
    const servicesQuery = query(
      safeCollection("services"),
      where("isArchived", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(servicesQuery, async (snapshot) => {
      const serviceData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          theme: data.theme || "Untitled Service",
          eventId: data.eventId,
        };
      });

      // Fetch events to get dates
      const eventIds = Array.from(new Set(serviceData.map((s) => s.eventId).filter(Boolean)));
      const eventMap = new Map<string, Date>();

      if (eventIds.length > 0) {
        const { getDocs, documentId } = await import("firebase/firestore");
        for (let i = 0; i < eventIds.length; i += 30) {
          const chunk = eventIds.slice(i, i + 30);
          const eventsQuery = query(
            safeCollection("events"),
            where(documentId(), "in", chunk)
          );
          const eventsSnap = await getDocs(eventsQuery);
          eventsSnap.docs.forEach((doc) => {
            const data = doc.data();
            const startDate = data.startDate?.toDate?.() || new Date();
            eventMap.set(doc.id, startDate);
          });
        }
      }

      const options: ServiceOption[] = serviceData.map((s) => {
        const date = eventMap.get(s.eventId);
        const dateStr = date
          ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "";
        return {
          id: s.id,
          label: `${s.theme}${dateStr ? ` (${dateStr})` : ""}`,
        };
      });

      setServices(options);
    });

    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter a title and content.",
        variant: "destructive",
      });
      return;
    }

    if (!userData || !firebaseUser) return;

    setSubmitting(true);

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/affirmations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          serviceId: serviceId || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create affirmation");
      }

      toast({
        title: "Affirmation created",
        description: "Your affirmation has been shared successfully.",
        variant: "success",
      });

      router.push("/affirmations");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create affirmation";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/manage/affirmations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            New Affirmation
          </h1>
          <p className="mt-1 text-clay-500">
            Share words of encouragement with the youth
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              Affirmation Details
            </CardTitle>
            <CardDescription>
              Write an affirmation to share with the Potter&apos;s Wheel community.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Walking in God's Purpose"
                required
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">
                Content <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your words of encouragement..."
                rows={8}
                required
              />
            </div>

            {/* Linked Service */}
            <div className="space-y-2">
              <Label htmlFor="service">Linked Service (Optional)</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service to link" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked service</SelectItem>
                  {services.map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-clay-400">
                Optionally link this affirmation to a specific service.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-clay-100">
              <Button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim()}
                variant="gold"
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Create Affirmation
                  </>
                )}
              </Button>
              <Link href="/manage/affirmations">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

export default function NewAffirmationPage() {
  return (
    <RoleProtected requiredRole="ADMIN">
      <div className="min-h-screen bg-cream">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <CreateAffirmationForm />
        </div>
      </div>
    </RoleProtected>
  );
}
