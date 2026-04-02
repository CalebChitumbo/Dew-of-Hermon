"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { canManageInstitutions } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ArrowLeft, Plus, Pencil, Shield, Check, X } from "lucide-react";

interface InstitutionItem {
  id: string;
  name: string;
  isActive: boolean;
  order: number;
}

export default function InstitutionsPage() {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const hasAccess = userData && canManageInstitutions(userData.role);

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
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-700">
          Access Denied
        </h2>
        <p className="text-clay-500 mt-2">
          You do not have permission to manage institutions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/manage/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
            Manage Institutions
          </h1>
          <p className="text-clay-500 mt-1">
            Add, edit, or deactivate student institutions
          </p>
        </div>
      </div>

      {/* Add New Institution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Institution</CardTitle>
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
          <CardTitle className="text-lg">Institutions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : institutions.length === 0 ? (
            <p className="text-clay-400 text-center py-8">
              No institutions yet. Add one above.
            </p>
          ) : (
            <div className="space-y-2">
              {institutions.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-lg border border-clay-200 px-4 py-3"
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
