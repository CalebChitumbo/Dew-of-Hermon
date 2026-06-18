"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Pencil, Shield, Check, X, GraduationCap, Building2 } from "lucide-react";

interface InstitutionItem {
  id: string;
  name: string;
  isActive: boolean;
  order: number;
}

export default function InstitutionsPage() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const { hasMinRole } = usePermissions();

  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const hasAccess = userData && hasMinRole("ADMIN");

  const fetchInstitutions = useCallback(async () => {
    try {
      const res = await fetch("/api/institutions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInstitutions(data.institutions);
    } catch (error) {
      console.error("Error fetching institutions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);

    try {
      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }

      toast({ title: "Institution added", variant: "success" });
      setNewName("");
      await fetchInstitutions();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id: string, updates: { name?: string; isActive?: boolean }) {
    try {
      const res = await fetch("/api/institutions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      toast({ title: "Institution updated", variant: "success" });
      setEditingId(null);
      await fetchInstitutions();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon={Shield}
        title="Access denied"
        description="You do not have permission to manage institutions."
        tone="clay"
        className="py-20"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        backHref="/manage/settings"
        icon={GraduationCap}
        tone="clay"
        title="Manage Institutions"
        description="Add, edit, or deactivate student institutions"
      />

      {/* Add New Institution */}
      <Card>
        <CardHeader>
          <SectionHeading>Add Institution</SectionHeading>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="newInstitution" className="sr-only">
                Institution Name
              </Label>
              <Input
                id="newInstitution"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter institution name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <Button onClick={handleAdd} disabled={adding || !newName.trim()} className="gap-2">
              {adding ? <LoadingSpinner size="sm" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Institutions List */}
      <Card>
        <CardHeader>
          <SectionHeading>Institutions</SectionHeading>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : institutions.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No institutions yet"
              description="Add one above to get started."
              tone="clay"
              className="py-8"
            />
          ) : (
            <div className="space-y-2">
              {institutions.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-lg border border-clay-100/70 px-4 py-3"
                >
                  {editingId === inst.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="max-w-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdate(inst.id, { name: editingName });
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleUpdate(inst.id, { name: editingName })}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4 text-clay-400" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-clay-700">
                          {inst.name}
                        </span>
                        {!inst.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(inst.id);
                            setEditingName(inst.name);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-clay-400" />
                        </Button>
                        <Button
                          size="sm"
                          variant={inst.isActive ? "outline" : "default"}
                          onClick={() =>
                            handleUpdate(inst.id, { isActive: !inst.isActive })
                          }
                        >
                          {inst.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
