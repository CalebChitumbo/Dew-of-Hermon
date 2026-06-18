"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Clock, Sparkles } from "lucide-react";
import { format } from "date-fns";

function CreateServiceForm() {
  const { userData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [date, setDate] = useState("");
  const [theme, setTheme] = useState("");
  const [venue, setVenue] = useState("");
  const [serviceTime, setServiceTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !venue || !serviceTime) {
      toast({
        title: "Missing fields",
        description: "Please fill in the date, venue, and service time.",
        variant: "destructive",
      });
      return;
    }

    if (!userData) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to create a service.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          theme: theme.trim() || null,
          venue: venue.trim(),
          serviceTime,
          callerRole: userData.role,
          callerId: userData.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create service");
      }

      toast({
        title: "Service created",
        description: `Service for ${format(new Date(date), "d MMMM yyyy")} has been created successfully.`,
        variant: "success",
      });

      // Redirect to the assignment board for this new service
      router.push(`/manage/services/${result.service.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create service";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Set default date to next Sunday
  const getNextSunday = () => {
    const today = new Date();
    const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return format(nextSunday, "yyyy-MM-dd");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        backHref="/manage/services"
        icon={Sparkles}
        tone="sage"
        title="Create Service"
        description="Set up a new service and start assigning roles"
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              Service Details
            </CardTitle>
            <CardDescription>
              Fill in the basic details for this service. You can assign roles on
              the next page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-clay-500" />
                Service Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="Select a date"
                min={format(new Date(), "yyyy-MM-dd")}
                required
              />
              {!date && (
                <button
                  type="button"
                  onClick={() => setDate(getNextSunday())}
                  className="text-xs text-teal hover:text-teal-dark underline"
                >
                  Set to next Sunday
                </button>
              )}
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-clay-500" />
                Theme / Title
              </Label>
              <Input
                id="theme"
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder='e.g., "Walking in Faith", "Youth Sunday"'
              />
              <p className="text-xs text-clay-400">
                Optional. A theme or title for this service.
              </p>
            </div>

            {/* Venue */}
            <div className="space-y-2">
              <Label htmlFor="venue" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-clay-500" />
                Venue <span className="text-red-500">*</span>
              </Label>
              <Input
                id="venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g., Main Hall, Chapel"
                required
              />
            </div>

            {/* Service Time */}
            <div className="space-y-2">
              <Label htmlFor="serviceTime" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-clay-500" />
                Service Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="serviceTime"
                type="time"
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                required
              />
            </div>

            {/* Preview */}
            {date && venue && (
              <div className="rounded-lg border border-clay-100/70 bg-cream/50 p-4">
                <p className="text-sm font-medium text-clay-600 mb-2">Preview</p>
                <div className="space-y-1">
                  <p className="text-lg font-display text-clay-700">
                    {theme || "Untitled Service"}
                  </p>
                  <p className="text-sm text-clay-500">
                    {format(new Date(date + "T00:00:00"), "EEEE, d MMMM yyyy")} at {serviceTime}
                  </p>
                  <p className="text-sm text-clay-500">{venue}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-clay-100">
              <Button
                type="submit"
                disabled={submitting || !date || !venue || !serviceTime}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Create Service
                  </>
                )}
              </Button>
              <Link href="/manage/services">
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

export default function NewServicePage() {
  return (
    <RoleProtected requiredRole="ADMIN">
      <div className="min-h-screen bg-cream">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <CreateServiceForm />
        </div>
      </div>
    </RoleProtected>
  );
}
