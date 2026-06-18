"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getDocs, query, orderBy } from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { User, Department, UserRole } from "@/types";
import { roleLabels } from "@/lib/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Search,
  Plus,
  Users,
  Mail,
  Phone,
  Shield,
  ChevronRight,
} from "lucide-react";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  departmentIds: string[];
  isActive: boolean;
}

export default function MembersPage() {
  const { userData } = useAuth();
  const { canManageMembers, canManageDeptMembers } = usePermissions();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch users
        const usersQuery = query(safeCollection("users"), orderBy("name"));
        const usersSnapshot = await getDocs(usersQuery);
        const usersData = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || null,
            role: (data.role || "MEMBER") as UserRole,
            departmentIds: data.departmentIds || [],
            isActive: data.isActive ?? true,
          };
        });
        setMembers(usersData);

        // Fetch departments
        const deptsQuery = query(safeCollection("departments"), orderBy("order"));
        const deptsSnapshot = await getDocs(deptsQuery);
        const deptsData = deptsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description || null,
            icon: data.icon || "Users",
            order: data.order || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Department;
        });
        setDepartments(deptsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach((dept) => {
      map[dept.id] = dept.name;
    });
    return map;
  }, [departments]);

  const isFullAdmin = userData && canManageMembers;
  const isDeptLead = userData && !isFullAdmin && canManageDeptMembers;
  const hasAccess = isFullAdmin || isDeptLead;

  // For DEPARTMENT_LEAD, only show members in their departments
  const leadDeptIds = userData?.leadsDepartmentIds || [];

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // DEPARTMENT_LEAD can only see members in their departments
      if (isDeptLead && leadDeptIds.length > 0) {
        const inLeadDept = member.departmentIds.some((dId) =>
          leadDeptIds.includes(dId)
        );
        if (!inLeadDept) return false;
      }

      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Role filter
      const matchesRole = filterRole === "all" || member.role === filterRole;

      // Department filter
      const matchesDepartment =
        filterDepartment === "all" ||
        member.departmentIds.includes(filterDepartment);

      return matchesSearch && matchesRole && matchesDepartment;
    });
  }, [members, searchQuery, filterRole, filterDepartment, isDeptLead, leadDeptIds]);

  if (!hasAccess) {
    return (
      <EmptyState
        icon={Shield}
        title="Access denied"
        description="You do not have permission to manage members."
        className="py-20"
      />
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
      <PageHeader
        title="Members"
        description="Manage church members and their roles"
        icon={Users}
        tone="periwinkle"
        actions={
          isFullAdmin ? (
            <Link href="/manage/members/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Role Filter */}
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Department Filter */}
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-clay-500">
        <Users className="h-4 w-4" />
        <span>
          {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}{" "}
          {searchQuery || filterRole !== "all" || filterDepartment !== "all"
            ? "found"
            : "total"}
        </span>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-clay-100 bg-cream/40">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-clay-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-clay-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-clay-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-clay-500 uppercase tracking-wider">
                    Departments
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-clay-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-clay-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-100">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-cream/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gold/20 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gold-dark">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-clay-700">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-clay-500">
                      {member.email}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[member.role]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {member.departmentIds.length > 0 ? (
                          member.departmentIds.map((deptId) => (
                            <Badge
                              key={deptId}
                              variant="outline"
                              className="text-xs"
                            >
                              {departmentMap[deptId] || deptId}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-clay-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={member.isActive ? "success" : "destructive"}
                        className="text-xs"
                      >
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/manage/members/${member.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-clay-400"
                    >
                      No members found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredMembers.map((member) => (
          <Link key={member.id} href={`/manage/members/${member.id}`}>
            <Card className="mb-3 transition-all hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-gold-dark">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-clay-700 truncate">
                          {member.name}
                        </h3>
                        <Badge
                          variant={member.isActive ? "success" : "destructive"}
                          className="text-xs flex-shrink-0"
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-clay-500 mb-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-1 text-sm text-clay-500 mb-2">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {roleLabels[member.role]}
                        </Badge>
                        {member.departmentIds.map((deptId) => (
                          <Badge
                            key={deptId}
                            variant="outline"
                            className="text-xs"
                          >
                            {departmentMap[deptId] || deptId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-clay-300 flex-shrink-0 mt-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filteredMembers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-clay-400">
              No members found matching your filters.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
