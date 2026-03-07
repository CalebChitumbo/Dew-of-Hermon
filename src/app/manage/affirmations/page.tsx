"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Affirmation } from "@/types";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Plus,
  Edit,
  Trash2,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";

export default function ManageAffirmationsPage() {
  const { userData } = useAuth();
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const affirmationsQuery = query(
      safeCollection("affirmations"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(affirmationsQuery, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          createdAt: raw.createdAt?.toDate?.() || new Date(),
          updatedAt: raw.updatedAt?.toDate?.() || new Date(),
        } as Affirmation;
      });
      setAffirmations(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(safeDoc("affirmations", deleteId));
    } catch (error) {
      console.error("Error deleting affirmation:", error);
    }
    setDeleteId(null);
    setDeleting(false);
  };

  return (
    <RoleProtected requiredRole="ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/affirmations">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
                Manage Affirmations
              </h1>
              <p className="text-clay-500 mt-1">
                Create, edit, and manage Potter&apos;s Wheel affirmations
              </p>
            </div>
          </div>
          <Link href="/manage/affirmations/new">
            <Button variant="gold">
              <Plus className="mr-2 h-4 w-4" />
              New Affirmation
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : affirmations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Sparkles className="h-12 w-12 text-gold/50 mb-4" />
              <h3 className="text-lg font-display font-semibold text-clay-600">
                No Affirmations Yet
              </h3>
              <p className="text-clay-400 text-sm mt-1">
                Create your first affirmation to share with the group.
              </p>
              <Link href="/manage/affirmations/new" className="mt-4">
                <Button variant="gold">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Affirmation
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {affirmations.map((affirmation) => (
              <Card key={affirmation.id}>
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-clay-700 truncate">
                        {affirmation.title}
                      </h3>
                      {affirmation === affirmations[0] && (
                        <Badge variant="gold">Latest</Badge>
                      )}
                    </div>
                    <p className="text-sm text-clay-400 mt-0.5 line-clamp-1">
                      {affirmation.content}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-clay-400 mt-1">
                      <span>By {affirmation.authorName}</span>
                      <span>&middot;</span>
                      <span>
                        {format(affirmation.createdAt, "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/manage/affirmations/${affirmation.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteId(affirmation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Affirmation</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this affirmation? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleProtected>
  );
}
