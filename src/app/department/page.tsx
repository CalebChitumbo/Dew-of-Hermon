"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  query,
  where,
  onSnapshot,
  updateDoc,
  arrayUnion,
  getDocs,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Department,
  ServiceRole,
  ServiceAssignment,
  Service,
  AppEvent,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  Building2,
  CalendarDays,
  Star,
  ChevronRight,
  Search,
} from "lucide-react";
import { format, isFuture, isToday } from "date-fns";

export default function DepartmentPage() {
  const { userData } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [services, setServices] = useState<Map<string, Service>>(new Map());
  const [events, setEvents] = useState<Map<string, AppEvent>>(new Map());
  const [loading, setLoading] = useState(true);

  // Add member dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingMember, setAddingMember] = useState<string | null>(null);

  const leadDeptIds = userData?.leadsDepartmentIds || [];

  // Listen to departments this user leads
  useEffect(() => {
    if (leadDeptIds.length === 0) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const depts = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        })) as Department[];
      setDepartments(depts.filter((dept) => leadDeptIds.includes(dept.id)));
    });

    return () => unsub();
  }, [leadDeptIds.join(",")]);

  // Listen to members in the department
  useEffect(() => {
    if (leadDeptIds.length === 0) return;

    const membersQuery = query(
      safeCollection("users"),
      where("departmentIds", "array-contains-any", leadDeptIds)
    );

    const unsub = onSnapshot(membersQuery, (snapshot) => {
      const memberData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as User[];
      setMembers(memberData);
      setLoading(false);
    });

    return () => unsub();
  }, [leadDeptIds.join(",")]);

  // Listen to all users (for adding members)
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("users"), (snapshot) => {
      const usrs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as User[];
      setAllUsers(usrs);
    });

    return () => unsub();
  }, []);

  // Listen to service roles for this department
  useEffect(() => {
    if (leadDeptIds.length === 0) return;

    const unsub = onSnapshot(safeCollection("serviceRoles"), (snapshot) => {
      const roleData = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() })) as ServiceRole[];
      setRoles(roleData.filter((r) => leadDeptIds.includes(r.departmentId)));
    });

    return () => unsub();
  }, [leadDeptIds.join(",")]);

  // Listen to assignments for department roles
  useEffect(() => {
    if (roles.length === 0) return;

    const roleIds = roles.map((r) => r.id);
    if (roleIds.length === 0) return;

    // Firestore "in" queries support up to 10 items
    const chunks: string[][] = [];
    for (let i = 0; i < roleIds.length; i += 10) {
      chunks.push(roleIds.slice(i, i + 10));
    }

    const unsubscribes: (() => void)[] = [];
    const allAssignments: ServiceAssignment[] = [];

    chunks.forEach((chunk) => {
      const assignQuery = query(
        safeCollection("serviceAssignments"),
        where("roleId", "in", chunk)
      );

      const unsub = onSnapshot(assignQuery, (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
            createdAt: raw.createdAt?.toDate?.() || new Date(),
            updatedAt: raw.updatedAt?.toDate?.() || new Date(),
            emailSentAt: raw.emailSentAt?.toDate?.() || null,
            confirmedAt: raw.confirmedAt?.toDate?.() || null,
          } as ServiceAssignment;
        });
        // Merge data from this chunk
        const chunkIds = new Set(data.map((a) => a.id));
        const filtered = allAssignments.filter((a) => !chunkIds.has(a.id));
        allAssignments.length = 0;
        allAssignments.push(...filtered, ...data);
        setAssignments([...allAssignments]);
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach((fn) => fn());
  }, [roles.map((r) => r.id).join(",")]);

  // Listen to services
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("services"), (snapshot) => {
      const svcMap = new Map<string, Service>();
      snapshot.docs.forEach((d) => {
        const data = d.data();
        svcMap.set(d.id, {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as Service);
      });
      setServices(svcMap);
    });

    return () => unsub();
  }, []);

  // Listen to events
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

  // Get upcoming service assignments for this department
  const upcomingAssignments = assignments.filter((a) => {
    const service = services.get(a.serviceId);
    const event = service ? events.get(service.eventId) : undefined;
    return event && (isFuture(event.startDate) || isToday(event.startDate));
  });

  const handleAddMember = async (userId: string) => {
    if (leadDeptIds.length === 0) return;
    setAddingMember(userId);
    try {
      await updateDoc(safeDoc("users", userId), {
        departmentIds: arrayUnion(...leadDeptIds),
      });
      setAddDialogOpen(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding member:", error);
    }
    setAddingMember(null);
  };

  // Filter users not already in department
  const memberIds = new Set(members.map((m) => m.id));
  const availableUsers = allUsers
    .filter((u) => !memberIds.has(u.id) && u.isActive)
    .filter(
      (u) =>
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (leadDeptIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 className="h-12 w-12 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-600">
          No Department Assigned
        </h2>
        <p className="text-clay-400 mt-2 text-center max-w-md">
          You are not currently leading any department. Contact an admin to be
          assigned as a department lead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            My Department
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {departments.map((dept) => (
              <Badge key={dept.id} variant="gold">
                {dept.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="gold" onClick={() => setAddDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
          <Link href="/department/recommend">
            <Button variant="outline">
              <Star className="mr-2 h-4 w-4" />
              Recommend
            </Button>
          </Link>
        </div>
      </div>

      {/* Team Members */}
      <div>
        <h2 className="text-lg font-display font-semibold text-clay-700 mb-4">
          Team Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-clay-300 mb-4" />
              <h3 className="text-lg font-display font-semibold text-clay-600">
                No Members Yet
              </h3>
              <p className="text-clay-400 text-sm mt-1">
                Add members to your department to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-gold/20 text-gold-dark font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-clay-700 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-clay-400">
                        {member.role.replace(/_/g, " ")}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-clay-500">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-2 text-xs text-clay-500">
                            <Phone className="h-3 w-3" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Service */}
      <div>
        <h2 className="text-lg font-display font-semibold text-clay-700 mb-4">
          Upcoming Department Service
        </h2>
        {upcomingAssignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CalendarDays className="h-10 w-10 text-clay-300 mb-3" />
              <p className="text-clay-500 text-sm">
                No upcoming assignments for your department roles.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingAssignments.slice(0, 10).map((assignment) => {
              const service = services.get(assignment.serviceId);
              const event = service ? events.get(service.eventId) : undefined;

              return (
                <Card key={assignment.id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 shrink-0">
                        <CalendarDays className="h-5 w-5 text-gold-dark" />
                      </div>
                      <div>
                        <p className="font-medium text-clay-700">
                          {assignment.roleName}
                        </p>
                        <p className="text-sm text-clay-400">
                          {assignment.userName} &middot;{" "}
                          {event
                            ? format(event.startDate, "EEE, MMM d")
                            : "TBD"}
                          {service?.serviceTime &&
                            ` at ${service.serviceTime}`}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={assignment.status} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommend Members Section */}
      <Card className="border-gold/30 bg-gold/5">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="font-display font-semibold text-clay-700">
              Recommend Members for Sunday Service
            </h3>
            <p className="text-sm text-clay-500 mt-1">
              Suggest members from your department for upcoming service roles
            </p>
          </div>
          <Link href="/department/recommend">
            <Button variant="gold" size="sm">
              Recommend
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Department</DialogTitle>
            <DialogDescription>
              Search for a member to add to your department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {availableUsers.length === 0 ? (
                <p className="text-center text-sm text-clay-400 py-4">
                  {searchQuery
                    ? "No matching members found"
                    : "All active members are in your department"}
                </p>
              ) : (
                availableUsers.slice(0, 20).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-clay-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-clay-100">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-clay-700">
                          {user.name}
                        </p>
                        <p className="text-xs text-clay-400">{user.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMember(user.id)}
                      disabled={addingMember === user.id}
                    >
                      {addingMember === user.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
