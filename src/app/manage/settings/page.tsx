"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoc, setDoc } from "firebase/firestore";
import { safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { EmptyState } from "@/components/shared/EmptyState";
import { iconTones } from "@/lib/icon-tones";
import {
  Settings,
  Save,
  Plus,
  Trash2,
  CheckSquare,
  GripVertical,
  GraduationCap,
  Shield,
  ChevronRight,
} from "lucide-react";

interface ChecklistTemplateItem {
  task: string;
  category: string;
  order: number;
}

export default function SettingsPage() {
  return (
    <RoleProtected requiredRole="SUPER_ADMIN">
      <SettingsContent />
    </RoleProtected>
  );
}

function SettingsContent() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistTemplateItem[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = safeDoc("settings", "checklistTemplate");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setChecklistItems(
            (data.items || []).sort(
              (a: ChecklistTemplateItem, b: ChecklistTemplateItem) => a.order - b.order
            )
          );
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = safeDoc("settings", "checklistTemplate");
      await setDoc(docRef, {
        items: checklistItems.map((item, idx) => ({
          ...item,
          order: idx + 1,
        })),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!newTask.trim() || !newCategory.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { task: newTask.trim(), category: newCategory.trim(), order: prev.length + 1 },
    ]);
    setNewTask("");
    setNewCategory("");
  };

  const removeItem = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const categories = Array.from(new Set(checklistItems.map((item) => item.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={Settings}
        tone="clay"
        title="Settings"
        description="Manage system configuration and defaults"
      />

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/manage/settings/access-control">
          <Card className="cursor-pointer transition-all hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)]">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTones.teal}`}>
                  <Shield className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-clay-700">Access Control</p>
                  <p className="text-sm text-clay-500">Customise role permissions for pages</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-clay-400" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/manage/settings/institutions">
          <Card className="cursor-pointer transition-all hover:bg-white hover:shadow-[0_8px_24px_-16px_rgba(91,58,41,0.18)]">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTones.gold}`}>
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-clay-700">Institutions</p>
                  <p className="text-sm text-clay-500">Manage student institutions</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-clay-400" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Checklist Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Service Checklist Template
          </CardTitle>
          <CardDescription>
            Default checklist items that are created for each new service. Changes will apply to future services only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Grouped by category */}
          {categories.map((category) => (
            <div key={category}>
              <SectionHeading className="mb-2">{category}</SectionHeading>
              <div className="space-y-2">
                {checklistItems
                  .map((item, originalIndex) => ({ item, originalIndex }))
                  .filter(({ item }) => item.category === category)
                  .map(({ item, originalIndex }) => (
                    <div
                      key={originalIndex}
                      className="flex items-center gap-3 rounded-md border border-clay-100/70 bg-white/70 px-3 py-2"
                    >
                      <GripVertical className="h-4 w-4 text-clay-300 flex-shrink-0" />
                      <span className="flex-1 text-sm text-clay-700">{item.task}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(originalIndex)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {checklistItems.length === 0 && (
            <EmptyState
              icon={CheckSquare}
              title="No checklist items yet"
              description="Add one below to get started."
              tone="clay"
              className="py-8"
            />
          )}

          {/* Add new item */}
          <div className="border-t border-clay-100/70 pt-4">
            <SectionHeading className="mb-3">Add New Item</SectionHeading>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="newTask" className="text-xs text-clay-500">Task</Label>
                <Input
                  id="newTask"
                  placeholder="e.g. Sound system tested"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addItem();
                  }}
                />
              </div>
              <div className="sm:w-48">
                <Label htmlFor="newCategory" className="text-xs text-clay-500">Category</Label>
                <Input
                  id="newCategory"
                  placeholder="e.g. Sound & Media"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  list="category-suggestions"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addItem();
                  }}
                />
                <datalist id="category-suggestions">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addItem}
                  disabled={!newTask.trim() || !newCategory.trim()}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end border-t border-clay-100/70 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
