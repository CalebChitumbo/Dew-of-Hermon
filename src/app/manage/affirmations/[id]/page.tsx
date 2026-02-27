"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Affirmation, Service, AppEvent } from "@/types";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { format } from "date-fns";

export default function AffirmationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { firebaseUser, userData } = useAuth();
  const id = params.id as string;
  const isNew = id === "new";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [serviceId, setServiceId] = useState<string>("none");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<Map<string, AppEvent>>(new Map());

  // Fetch existing affirmation for edit mode
  useEffect(() => {
    if (isNew) return;

    const fetchAffirmation = async () => {
      try {
        const docSnap = await getDoc(doc(db, "affirmations", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title || "");
          setContent(data.content || "");
          setServiceId(data.serviceId || "none");
        }
      } catch (error) {
        console.error("Error fetching affirmation:", error);
      }
      setLoading(false);
    };

    fetchAffirmation();
  }, [id, isNew]);

  // Fetch services
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "services"), (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          createdAt: raw.createdAt?.toDate?.() || new Date(),
          updatedAt: raw.updatedAt?.toDate?.() || new Date(),
        } as Service;
      });
      setServices(data);
    });

    return () => unsub();
  }, []);

  // Fetch events
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (snapshot) => {
      const evtMap = new Map<string, AppEvent>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        evtMap.set(d.id, {
          id: d.id,
          ...data,
          startDate: data.startDate?.toDate?.() || new Date(),
          endDate: data.endDate?.toDate?.() || null,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as AppEvent);
      });
      setEvents(evtMap);
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!firebaseUser || !userData || !title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      const affirmationData = {
        title: title.trim(),
        content: content.trim(),
        serviceId: serviceId === "none" ? null : serviceId,
        authorId: firebaseUser.uid,
        authorName: userData.name,
        updatedAt: Timestamp.now(),
      };

      if (isNew) {
        await addDoc(collection(db, "affirmations"), {
          ...affirmationData,
          createdAt: Timestamp.now(),
        });
      } else {
        await updateDoc(doc(db, "affirmations", id), affirmationData);
      }

      router.push("/manage/affirmations");
    } catch (error) {
      console.error("Error saving affirmation:", error);
    }
    setSaving(false);
  };

  // Sort services by event date descending
  const sortedServices = [...services].sort((a, b) => {
    const ea = events.get(a.eventId);
    const eb = events.get(b.eventId);
    return (eb?.startDate?.getTime() || 0) - (ea?.startDate?.getTime() || 0);
  });

  if (loading) {
    return (
      <RoleProtected requiredRole="ADMIN">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="ADMIN">
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
              {isNew ? "New Affirmation" : "Edit Affirmation"}
            </h1>
            <p className="text-clay-500 mt-1">
              {isNew
                ? "Create a new Potter's Wheel affirmation"
                : "Update this affirmation"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter affirmation title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Write the affirmation content..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="min-h-[200px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Service (optional)</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked service</SelectItem>
                    {sortedServices.map((svc) => {
                      const event = events.get(svc.eventId);
                      return (
                        <SelectItem key={svc.id} value={svc.id}>
                          {event
                            ? `${format(event.startDate, "MMM d, yyyy")} - ${event.title}`
                            : svc.id}
                          {svc.theme && ` (${svc.theme})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="gold"
                onClick={handleSave}
                disabled={!title.trim() || !content.trim() || saving}
                className="w-full"
              >
                {saving ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isNew ? "Publish Affirmation" : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="border-gold/40 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-gold via-gold-dark to-gold" />
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-clay-400 mb-2">
                <Sparkles className="h-4 w-4 text-gold" />
                Preview
              </div>
              <CardTitle className="text-xl text-clay-700">
                {title || "Untitled Affirmation"}
              </CardTitle>
              <CardDescription>
                {userData?.name || "Author"} &middot;{" "}
                {format(new Date(), "MMM d, yyyy")}
                {serviceId && serviceId !== "none" && (
                  <>
                    {" "}
                    &middot;{" "}
                    {(() => {
                      const svc = services.find((s) => s.id === serviceId);
                      const evt = svc ? events.get(svc.eventId) : undefined;
                      return evt
                        ? format(evt.startDate, "MMM d")
                        : "Linked service";
                    })()}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-clay-600 whitespace-pre-wrap leading-relaxed">
                {content || "Your affirmation content will appear here..."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleProtected>
  );
}
