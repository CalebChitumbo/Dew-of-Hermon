"use client";

import { useEffect, useState } from "react";
import {
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { ServiceRole, Department } from "@/types";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Mail,
  Save,
  Eye,
  Edit,
  CheckCircle,
  ArrowLeft,
  Clock,
  CalendarDays,
} from "lucide-react";

// Placeholder tokens available in templates
const PLACEHOLDERS = [
  { token: "{{memberName}}", description: "Member's full name" },
  { token: "{{roleName}}", description: "Assigned role name" },
  { token: "{{serviceDate}}", description: "Service date (formatted)" },
  { token: "{{serviceTime}}", description: "Service time" },
  { token: "{{arrivalTime}}", description: "Required arrival time" },
  { token: "{{venue}}", description: "Service venue" },
  { token: "{{theme}}", description: "Service theme" },
  { token: "{{eventTitle}}", description: "Event title" },
  { token: "{{confirmLink}}", description: "Confirmation link" },
];

export default function TemplatesPage() {
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [departments, setDepartments] = useState<Map<string, Department>>(new Map());
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedRoleId, setSavedRoleId] = useState<string | null>(null);

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(safeCollection("serviceRoles"), (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() })) as ServiceRole[];
      setRoles(data.sort((a, b) => a.order - b.order));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(safeCollection("departments"), (snapshot) => {
      const deptMap = new Map<string, Department>();
      snapshot.docs.forEach((d) => {
        deptMap.set(d.id, {
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        } as Department);
      });
      setDepartments(deptMap);
    });

    return () => unsub();
  }, []);

  const startEditing = (role: ServiceRole) => {
    setEditingRole(role.id);
    setEditSubject(role.emailSubject);
    setEditBody(role.emailBody);
    setPreviewMode(false);
  };

  const cancelEditing = () => {
    setEditingRole(null);
    setEditSubject("");
    setEditBody("");
    setPreviewMode(false);
  };

  const handleSave = async () => {
    if (!editingRole) return;
    setSaving(true);

    try {
      await updateDoc(safeDoc("serviceRoles", editingRole), {
        emailSubject: editSubject,
        emailBody: editBody,
      });
      setSavedRoleId(editingRole);
      setEditingRole(null);
      setTimeout(() => setSavedRoleId(null), 3000);
    } catch (error) {
      console.error("Error saving template:", error);
    }
    setSaving(false);
  };

  // Replace placeholders with sample data for preview
  const getPreviewText = (text: string) => {
    return text
      .replace(/\{\{memberName\}\}/g, "Jane Doe")
      .replace(/\{\{roleName\}\}/g, "Worship Leader")
      .replace(/\{\{serviceDate\}\}/g, "Sunday, March 15, 2026")
      .replace(/\{\{serviceTime\}\}/g, "9:00 AM")
      .replace(/\{\{arrivalTime\}\}/g, "8:00 AM")
      .replace(/\{\{venue\}\}/g, "Main Auditorium")
      .replace(/\{\{theme\}\}/g, "Walking in Faith")
      .replace(/\{\{eventTitle\}\}/g, "Potter's Wheel Sunday Service")
      .replace(/\{\{confirmLink\}\}/g, "https://app.potterswheel.com/confirm/abc123");
  };

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
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Email Templates
          </h1>
          <p className="text-clay-500 mt-1">
            Customize email templates for each service role. Emails are sent as
            reminders to assigned members.
          </p>
        </div>

        {/* Placeholder reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-clay-600">
              Available Placeholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map((p) => (
                <Badge
                  key={p.token}
                  variant="secondary"
                  className="font-mono text-xs cursor-help"
                  title={p.description}
                >
                  {p.token}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role templates list */}
        <div className="space-y-4">
          {roles.map((role) => {
            const dept = departments.get(role.departmentId);
            const isEditing = editingRole === role.id;
            const justSaved = savedRoleId === role.id;

            return (
              <Card
                key={role.id}
                className={
                  isEditing
                    ? "border-gold ring-1 ring-gold/20"
                    : justSaved
                    ? "border-teal"
                    : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Mail className="h-5 w-5 text-clay-400" />
                        {role.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {dept && (
                          <Badge variant="outline" className="text-xs">
                            {dept.name}
                          </Badge>
                        )}
                        {role.reminderSchedule.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-clay-400">
                            <Clock className="h-3 w-3" />
                            {role.reminderSchedule.join(", ")}
                          </span>
                        )}
                        {role.arrivalTime && (
                          <span className="text-xs text-clay-400">
                            Arrive: {role.arrivalTime}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {justSaved && (
                        <span className="flex items-center gap-1 text-teal text-xs">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Saved
                        </span>
                      )}
                      {!isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(role)}
                        >
                          <Edit className="mr-1 h-4 w-4" />
                          Edit Template
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {isEditing ? (
                    <div className="space-y-4">
                      <Tabs
                        value={previewMode ? "preview" : "edit"}
                        onValueChange={(v) => setPreviewMode(v === "preview")}
                      >
                        <TabsList>
                          <TabsTrigger value="edit">
                            <Edit className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </TabsTrigger>
                          <TabsTrigger value="preview">
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Preview
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="edit" className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              placeholder="Email subject line..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Body</Label>
                            <Textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              placeholder="Email body content..."
                              rows={8}
                              className="font-mono text-sm min-h-[200px]"
                            />
                          </div>
                        </TabsContent>

                        <TabsContent value="preview" className="mt-4">
                          <Card className="bg-clay-50">
                            <CardContent className="p-4 space-y-3">
                              <div>
                                <p className="text-xs font-medium text-clay-400 uppercase tracking-wider">
                                  Subject
                                </p>
                                <p className="text-sm font-medium text-clay-700 mt-1">
                                  {getPreviewText(editSubject)}
                                </p>
                              </div>
                              <Separator />
                              <div>
                                <p className="text-xs font-medium text-clay-400 uppercase tracking-wider">
                                  Body
                                </p>
                                <p className="text-sm text-clay-600 whitespace-pre-wrap mt-1 leading-relaxed">
                                  {getPreviewText(editBody)}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>

                      <div className="flex gap-2">
                        <Button
                          variant="gold"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Template
                        </Button>
                        <Button variant="outline" onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-clay-400 uppercase tracking-wider">
                          Subject
                        </p>
                        <p className="text-sm text-clay-700 mt-0.5">
                          {role.emailSubject || (
                            <span className="italic text-clay-300">
                              No subject set
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-clay-400 uppercase tracking-wider">
                          Body
                        </p>
                        <p className="text-sm text-clay-500 mt-0.5 line-clamp-2">
                          {role.emailBody || (
                            <span className="italic text-clay-300">
                              No body set
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {roles.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-clay-300 mb-4" />
              <h3 className="text-lg font-display font-semibold text-clay-600">
                No Service Roles
              </h3>
              <p className="text-clay-400 text-sm mt-1">
                Create service roles first to set up email templates.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </RoleProtected>
  );
}
