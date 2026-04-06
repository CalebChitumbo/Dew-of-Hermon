"use client";

import { useEffect, useState, useMemo } from "react";
import { getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabels } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import type { UserRole, AssignmentStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Shield,
  Building2,
  ClipboardList,
  TrendingUp,
} from "lucide-react";

interface MemberSummary {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
}

interface DepartmentSummary {
  id: string;
  name: string;
  memberCount: number;
}

interface ServiceSummary {
  totalServices: number;
  totalAssignments: number;
  confirmed: number;
  pending: number;
  declined: number;
  noResponse: number;
}

export default function ReportsPage() {
  const { userData } = useAuth();
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [memberSummary, setMemberSummary] = useState<MemberSummary>({
    total: 0,
    active: 0,
    inactive: 0,
    byRole: {},
  });
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [serviceSummary, setServiceSummary] = useState<ServiceSummary>({
    totalServices: 0,
    totalAssignments: 0,
    confirmed: 0,
    pending: 0,
    declined: 0,
    noResponse: 0,
  });

  useEffect(() => {
    async function fetchReportData() {
      try {
        // Fetch members
        const usersSnapshot = await getDocs(
          query(safeCollection("users"), orderBy("name"))
        );
        const users = usersSnapshot.docs.map((doc) => doc.data());

        const byRole: Record<string, number> = {};
        let active = 0;
        let inactive = 0;

        users.forEach((u) => {
          const role = (u.role || "MEMBER") as string;
          byRole[role] = (byRole[role] || 0) + 1;
          if (u.isActive !== false) {
            active++;
          } else {
            inactive++;
          }
        });

        setMemberSummary({
          total: users.length,
          active,
          inactive,
          byRole,
        });

        // Fetch departments and count members per department
        const deptsSnapshot = await getDocs(
          query(safeCollection("departments"), orderBy("order"))
        );
        const deptsData = deptsSnapshot.docs.map((doc) => {
          const data = doc.data();
          const deptId = doc.id;
          const memberCount = users.filter(
            (u) => Array.isArray(u.departmentIds) && u.departmentIds.includes(deptId)
          ).length;
          return {
            id: deptId,
            name: data.name as string,
            memberCount,
          };
        });
        setDepartments(deptsData);

        // Fetch services
        const servicesSnapshot = await getDocs(safeCollection("services"));
        const totalServices = servicesSnapshot.size;

        // Fetch all assignments
        const assignmentsSnapshot = await getDocs(safeCollection("serviceAssignments"));
        let confirmed = 0;
        let pending = 0;
        let declined = 0;
        let noResponse = 0;

        assignmentsSnapshot.docs.forEach((doc) => {
          const status = doc.data().status as AssignmentStatus;
          switch (status) {
            case "CONFIRMED":
              confirmed++;
              break;
            case "PENDING":
              pending++;
              break;
            case "DECLINED":
              declined++;
              break;
            case "NO_RESPONSE":
              noResponse++;
              break;
          }
        });

        setServiceSummary({
          totalServices,
          totalAssignments: assignmentsSnapshot.size,
          confirmed,
          pending,
          declined,
          noResponse,
        });
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, []);

  const confirmationRate = useMemo(() => {
    if (serviceSummary.totalAssignments === 0) return 0;
    return Math.round(
      (serviceSummary.confirmed / serviceSummary.totalAssignments) * 100
    );
  }, [serviceSummary]);

  if (!userData || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to view reports.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
          Reports
        </h1>
        <p className="text-clay-500 mt-1">
          Overview of membership and service statistics
        </p>
      </div>

      {/* Member Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {memberSummary.total}
                </p>
                <p className="text-xs text-clay-400">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {memberSummary.active}
                </p>
                <p className="text-xs text-clay-400">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {memberSummary.inactive}
                </p>
                <p className="text-xs text-clay-400">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold-dark">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-clay-700">
                  {confirmationRate}%
                </p>
                <p className="text-xs text-clay-400">Confirmation Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members by Role + Departments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members by Role */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-clay-400" />
              Members by Role
            </CardTitle>
            <CardDescription>
              Breakdown of members across roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(Object.keys(roleLabels) as UserRole[]).map((role) => {
                const count = memberSummary.byRole[role] || 0;
                const percentage =
                  memberSummary.total > 0
                    ? Math.round((count / memberSummary.total) * 100)
                    : 0;
                return (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[role]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-clay-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-clay-700 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-clay-400" />
              Departments
            </CardTitle>
            <CardDescription>
              Members per department
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departments.length > 0 ? (
              <div className="space-y-3">
                {departments.map((dept) => {
                  const percentage =
                    memberSummary.total > 0
                      ? Math.round((dept.memberCount / memberSummary.total) * 100)
                      : 0;
                  return (
                    <div key={dept.id} className="flex items-center justify-between">
                      <span className="text-sm text-clay-700 truncate">
                        {dept.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-clay-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-clay-700 w-8 text-right">
                          {dept.memberCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-clay-400 text-center py-4">
                No departments configured.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Assignment Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-clay-400" />
            Service Assignments
          </CardTitle>
          <CardDescription>
            Summary across all {serviceSummary.totalServices} services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 rounded-lg bg-clay-50">
              <p className="text-2xl font-display font-bold text-clay-700">
                {serviceSummary.totalAssignments}
              </p>
              <p className="text-xs text-clay-400 mt-1">Total Assignments</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-teal/5">
              <p className="text-2xl font-display font-bold text-teal">
                {serviceSummary.confirmed}
              </p>
              <p className="text-xs text-clay-400 mt-1">Confirmed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-gold/5">
              <p className="text-2xl font-display font-bold text-gold-dark">
                {serviceSummary.pending}
              </p>
              <p className="text-xs text-clay-400 mt-1">Pending</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50">
              <p className="text-2xl font-display font-bold text-red-500">
                {serviceSummary.declined}
              </p>
              <p className="text-xs text-clay-400 mt-1">Declined</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50">
              <p className="text-2xl font-display font-bold text-yellow-600">
                {serviceSummary.noResponse}
              </p>
              <p className="text-xs text-clay-400 mt-1">No Response</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
