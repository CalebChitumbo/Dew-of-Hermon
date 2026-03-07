"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  query,
  where,
  onSnapshot,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { User, Department, ServiceRole, Service, AppEvent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  ArrowLeft,
  Star,
  Send,
  CheckCircle,
  CalendarDays,
} from "lucide-react";
import { format, isFuture, isToday } from "date-fns";

interface Recommendation {
  id?: string;
  userId: string;
  userName: string;
  roleId: string;
  roleName: string;
  serviceId: string;
  recommendedBy: string;
  recommendedByName: string;
  notes: string;
  createdAt: Date;
}

export default function RecommendPage() {
  const { firebaseUser, userData } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<Map<string, AppEvent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [notes, setNotes] = useState("");

  const leadDeptIds = userData?.leadsDepartmentIds || [];

  // Fetch department members
  useEffect(() => {
    if (leadDeptIds.length === 0) {
      setLoading(false);
      return;
    }

    const membersQuery = query(
      safeCollection("users"),
      where("departmentIds", "array-contains-any", leadDeptIds)
    );

    const unsub = onSnapshot(membersQuery, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as User[];
      setMembers(data.filter((m) => m.isActive));
      setLoading(false);
    });

    return () => unsub();
  }, [leadDeptIds.join(",")]);

  // Fetch department roles
  useEffect(() => {
    if (leadDeptIds.length === 0) return;

    const unsub = onSnapshot(safeCollection("serviceRoles"), (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() })) as ServiceRole[];
      setRoles(data.filter((r) => leadDeptIds.includes(r.departmentId)));
    });

    return () => unsub();
  }, [leadDeptIds.join(",")]);

  // Fetch upcoming services
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("services"), (snapshot) => {
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
    const unsub = onSnapshot(safeCollection("events"), (snapshot) => {
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

  // Get upcoming services with event dates
  const upcomingServices = services
    .filter((s) => {
      const event = events.get(s.eventId);
      return event && (isFuture(event.startDate) || isToday(event.startDate));
    })
    .sort((a, b) => {
      const ea = events.get(a.eventId);
      const eb = events.get(b.eventId);
      return (ea?.startDate?.getTime() || 0) - (eb?.startDate?.getTime() || 0);
    });

  const handleSubmit = async () => {
    if (!firebaseUser || !userData || !selectedMember || !selectedRole || !selectedService) return;

    const member = members.find((m) => m.id === selectedMember);
    const role = roles.find((r) => r.id === selectedRole);
    if (!member || !role) return;

    setSubmitting(true);
    try {
      await addDoc(safeCollection("recommendations"), {
        userId: selectedMember,
        userName: member.name,
        roleId: selectedRole,
        roleName: role.name,
        serviceId: selectedService,
        recommendedBy: firebaseUser.uid,
        recommendedByName: userData.name,
        notes: notes || null,
        createdAt: Timestamp.now(),
      });
      setSubmitted(true);
      setSelectedMember("");
      setSelectedRole("");
      setSelectedService("");
      setNotes("");

      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      console.error("Error submitting recommendation:", error);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/department">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Recommend Members
          </h1>
          <p className="text-clay-500 mt-1">
            Suggest members from your department for upcoming service roles
          </p>
        </div>
      </div>

      {submitted && (
        <Card className="border-teal bg-teal/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-teal" />
            <p className="text-sm font-medium text-teal-dark">
              Recommendation submitted successfully! Admin will review it.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-gold" />
            New Recommendation
          </CardTitle>
          <CardDescription>
            Recommend a department member for a specific role in an upcoming
            service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upcoming Service</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Select an upcoming service" />
              </SelectTrigger>
              <SelectContent>
                {upcomingServices.map((service) => {
                  const event = events.get(service.eventId);
                  return (
                    <SelectItem key={service.id} value={service.id}>
                      {event
                        ? `${format(event.startDate, "MMM d, yyyy")} - ${event.title}`
                        : service.id}
                      {service.theme && ` (${service.theme})`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Why you recommend this member for this role..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            variant="gold"
            onClick={handleSubmit}
            disabled={
              !selectedMember ||
              !selectedRole ||
              !selectedService ||
              submitting
            }
          >
            {submitting ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit Recommendation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
