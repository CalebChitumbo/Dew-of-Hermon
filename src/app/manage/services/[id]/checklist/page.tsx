"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardList,
  Calendar,
  User,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ChecklistItem, Service, AppEvent } from "@/types";

// ─── Category Icons & Colors ───

const categoryStyles: Record<string, { color: string; bgColor: string }> = {
  Technical: { color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  Worship: { color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
  Ministry: { color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  Hospitality: { color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  Admin: { color: "text-clay-700", bgColor: "bg-clay-50 border-clay-200" },
};

function getCategoryStyle(category: string) {
  return (
    categoryStyles[category] || {
      color: "text-clay-700",
      bgColor: "bg-clay-50 border-clay-200",
    }
  );
}

// ─── Checklist Item Component ───

interface ChecklistItemRowProps {
  item: ChecklistItem;
  onToggle: (itemId: string, isCompleted: boolean) => void;
  toggling: string | null;
}

function ChecklistItemRow({ item, onToggle, toggling }: ChecklistItemRowProps) {
  const isToggling = toggling === item.id;

  return (
    <button
      onClick={() => onToggle(item.id, !item.isCompleted)}
      disabled={isToggling}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors border ${
        item.isCompleted
          ? "bg-green-50/50 border-green-200/50"
          : "bg-white border-clay-200 hover:bg-clay-50"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isToggling ? (
          <LoadingSpinner size="sm" />
        ) : item.isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5 text-clay-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            item.isCompleted ? "text-clay-400 line-through" : "text-clay-700"
          }`}
        >
          {item.task}
        </p>
        {item.isCompleted && item.completedBy && (
          <div className="flex items-center gap-1 mt-1">
            <User className="h-3 w-3 text-clay-400" />
            <span className="text-xs text-clay-400">
              Completed by {item.completedBy}
            </span>
            {item.updatedAt && (
              <span className="text-xs text-clay-300">
                {" "}
                &middot;{" "}
                {formatDistanceToNow(
                  item.updatedAt instanceof Date
                    ? item.updatedAt
                    : new Date(item.updatedAt),
                  { addSuffix: true }
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Main Checklist Content ───

function ChecklistContent() {
  const params = useParams();
  const serviceId = params.id as string;
  const { userData } = useAuth();
  const { toast } = useToast();

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [eventData, setEventData] = useState<AppEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // ─── Load service info ───

  useEffect(() => {
    if (!serviceId) return;

    const unsubService = onSnapshot(
      safeDoc("services", serviceId),
      async (snapshot) => {
        if (!snapshot.exists()) {
          setService(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        setService({
          id: snapshot.id,
          eventId: data.eventId,
          theme: data.theme || null,
          serviceTime: data.serviceTime,
          programNotes: data.programNotes || null,
          attendanceCount: data.attendanceCount || null,
          isArchived: data.isArchived || false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        });

        // Fetch event
        if (data.eventId) {
          const eventDoc = await getDoc(safeDoc("events", data.eventId));
          if (eventDoc.exists()) {
            const eData = eventDoc.data();
            setEventData({
              id: eventDoc.id,
              title: eData.title,
              description: eData.description || null,
              type: eData.type,
              startDate: eData.startDate?.toDate?.() || new Date(),
              endDate: eData.endDate?.toDate?.() || null,
              venue: eData.venue,
              isRecurring: eData.isRecurring || false,
              createdBy: eData.createdBy,
              lifeGroupTarget: eData.lifeGroupTarget || null,
              approvalStatus: eData.approvalStatus || "APPROVED",
              approvalComments: eData.approvalComments || null,
              approvedBy: eData.approvedBy || null,
              approvedAt: eData.approvedAt?.toDate?.() || null,
              createdByDepartmentId: eData.createdByDepartmentId || null,
              coreRoles: eData.coreRoles || [],
              transportRequired: eData.transportRequired || false,
              transportNeeds: eData.transportNeeds || null,
              transportRequestId: eData.transportRequestId || null,
              budgetRequested: eData.budgetRequested || false,
              budgetAmount: eData.budgetAmount ?? null,
              budgetCurrency: eData.budgetCurrency || null,
              budgetPurpose: eData.budgetPurpose || null,
              budgetRequestId: eData.budgetRequestId || null,
              createdAt: eData.createdAt?.toDate?.() || new Date(),
              updatedAt: eData.updatedAt?.toDate?.() || new Date(),
            });
          }
        }

        setLoading(false);
      }
    );

    return () => unsubService();
  }, [serviceId]);

  // ─── Load checklist items (real-time) ───

  useEffect(() => {
    if (!serviceId) return;

    const checklistRef = safeCollection("checklistItems");
    const checklistQuery = query(
      checklistRef,
      where("serviceId", "==", serviceId),
      orderBy("order")
    );

    const unsubChecklist = onSnapshot(checklistQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          serviceId: data.serviceId,
          task: data.task,
          category: data.category,
          isCompleted: data.isCompleted || false,
          completedBy: data.completedBy || null,
          order: data.order || 0,
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as ChecklistItem;
      });
      setChecklistItems(items);
    });

    return () => unsubChecklist();
  }, [serviceId]);

  // ─── Toggle handler ───

  const handleToggle = useCallback(
    async (itemId: string, isCompleted: boolean) => {
      if (!userData) return;

      setToggling(itemId);
      try {
        const itemRef = safeDoc("checklistItems", itemId);
        await updateDoc(itemRef, {
          isCompleted,
          completedBy: isCompleted ? userData.name : null,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Error toggling checklist item:", error);
        toast({
          title: "Error",
          description: "Failed to update checklist item",
          variant: "destructive",
        });
      } finally {
        setToggling(null);
      }
    },
    [userData, toast]
  );

  // ─── Group items by category ───

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, ChecklistItem[]> = {};
    checklistItems.forEach((item) => {
      const cat = item.category || "General";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [checklistItems]);

  const completedCount = checklistItems.filter((i) => i.isCompleted).length;
  const totalCount = checklistItems.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ─── Render ───

  if (loading) return <PageLoader />;

  if (!service) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-display text-clay-700">
            Service Not Found
          </h2>
          <p className="mt-2 text-clay-500 mb-4">
            This service may have been deleted.
          </p>
          <Link href="/manage/services">
            <Button variant="outline">Back to Services</Button>
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = eventData?.startDate
    ? new Date(eventData.startDate as unknown as string)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/manage/services/${serviceId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-700">
            Service Checklist
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-clay-500">
            <span>{service.theme || "Untitled Service"}</span>
            {eventDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(eventDate, "d MMM yyyy")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-clay-500" />
              <span className="font-medium text-clay-700">
                Pre-Service Tasks
              </span>
            </div>
            <Badge
              variant={progressPercent === 100 ? "success" : "secondary"}
              className="text-sm"
            >
              {completedCount}/{totalCount} complete
            </Badge>
          </div>
          <div className="w-full h-3 bg-clay-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100 ? "bg-green-500" : "bg-teal"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              All tasks complete! Service is ready.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Checklist by Category */}
      {totalCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-clay-300 mx-auto mb-4" />
            <h3 className="text-lg font-display text-clay-600 mb-2">
              No Checklist Items
            </h3>
            <p className="text-sm text-clay-400">
              No checklist items have been created for this service yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(itemsByCategory).map(([category, items]) => {
            const catStyle = getCategoryStyle(category);
            const catCompleted = items.filter((i) => i.isCompleted).length;

            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-base ${catStyle.color}`}>
                      {category}
                    </CardTitle>
                    <Badge
                      variant={
                        catCompleted === items.length ? "success" : "secondary"
                      }
                      className="text-xs"
                    >
                      {catCompleted}/{items.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((item) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      toggling={toggling}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ServiceChecklistPage() {
  return (
    <RoleProtected requiredRole="DEPARTMENT_LEAD">
      <div className="min-h-screen bg-cream">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <ChecklistContent />
        </div>
      </div>
    </RoleProtected>
  );
}
