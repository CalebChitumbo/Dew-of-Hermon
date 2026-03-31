"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  onSnapshot,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { hasMinRole } from "@/lib/permissions";
import {
  User,
  Department,
  DepartmentTask,
  TaskStatus,
  TaskPriority,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  UserMinus,
  Phone,
  Mail,
  Building2,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  ArrowLeft,
  Search,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";

const priorityColors: Record<TaskPriority, string> = {
  LOW: "bg-clay-100 text-clay-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const statusIcons: Record<TaskStatus, React.ElementType> = {
  TODO: Circle,
  IN_PROGRESS: Clock,
  DONE: CheckCircle2,
};

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deptId = params.id as string;
  const { userData } = useAuth();

  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<DepartmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Dialogs
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  // New task form
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    assigneeId: "",
    dueDate: "",
  });

  const [activeTab, setActiveTab] = useState<"tasks" | "members">("tasks");

  const isAdmin = userData ? hasMinRole(userData.role, "ADMIN") : false;
  const isDeptLead =
    isAdmin || (userData?.leadsDepartmentIds || []).includes(deptId);

  // Listen to this department
  useEffect(() => {
    const unsub = onSnapshot(safeDoc("departments", deptId), (snap) => {
      if (snap.exists()) {
        setDepartment({
          id: snap.id,
          ...snap.data(),
          createdAt: snap.data().createdAt?.toDate?.() || new Date(),
        } as Department);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [deptId]);

  // Listen to members in this department
  useEffect(() => {
    const membersQuery = query(
      safeCollection("users"),
      where("departmentIds", "array-contains", deptId)
    );

    const unsub = onSnapshot(membersQuery, (snapshot) => {
      setMembers(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
          updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
        })) as User[]
      );
    });

    return () => unsub();
  }, [deptId]);

  // Listen to all users (for add member dialog)
  useEffect(() => {
    const unsub = onSnapshot(safeCollection("users"), (snapshot) => {
      setAllUsers(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
          updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
        })) as User[]
      );
    });
    return () => unsub();
  }, []);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/department-tasks?departmentId=${deptId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(
          data.tasks.map((t: DepartmentTask & { dueDate: string | null; completedAt: string | null; createdAt: string; updatedAt: string }) => ({
            ...t,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            completedAt: t.completedAt ? new Date(t.completedAt) : null,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
    setTasksLoading(false);
  }, [deptId]);

  useEffect(() => {
    if (isDeptLead) {
      fetchTasks();
    }
  }, [isDeptLead, fetchTasks]);

  const handleAddMember = async (userId: string) => {
    setAddingMember(userId);
    try {
      await updateDoc(safeDoc("users", userId), {
        departmentIds: arrayUnion(deptId),
      });
      setAddMemberOpen(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding member:", error);
    }
    setAddingMember(null);
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingMember(userId);
    try {
      await updateDoc(safeDoc("users", userId), {
        departmentIds: arrayRemove(deptId),
      });
    } catch (error) {
      console.error("Error removing member:", error);
    }
    setRemovingMember(null);
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    setCreatingTask(true);

    const assignee = newTask.assigneeId
      ? members.find((m) => m.id === newTask.assigneeId)
      : null;

    try {
      const res = await fetch("/api/department-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: deptId,
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          assigneeId: assignee?.id || null,
          assigneeName: assignee?.name || null,
          dueDate: newTask.dueDate || null,
        }),
      });

      if (res.ok) {
        setCreateTaskOpen(false);
        setNewTask({
          title: "",
          description: "",
          priority: "MEDIUM",
          assigneeId: "",
          dueDate: "",
        });
        fetchTasks();
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
    setCreatingTask(false);
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    status: TaskStatus
  ) => {
    try {
      await fetch("/api/department-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/department-tasks?taskId=${taskId}`, {
        method: "DELETE",
      });
      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Filter available users (not already in department)
  const memberIds = new Set(members.map((m) => m.id));
  const availableUsers = allUsers
    .filter((u) => !memberIds.has(u.id) && u.isActive)
    .filter(
      (u) =>
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Separate tasks by status
  const todoTasks = tasks.filter((t) => t.status === "TODO");
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS");
  const doneTasks = tasks.filter((t) => t.status === "DONE");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!department) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 className="h-12 w-12 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-600">
          Department Not Found
        </h2>
        <Link href="/departments" className="mt-4">
          <Button variant="outline">Back to Departments</Button>
        </Link>
      </div>
    );
  }

  if (!isDeptLead) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-clay-300 mb-4" />
        <h2 className="text-xl font-display font-semibold text-clay-600">
          Access Restricted
        </h2>
        <p className="text-clay-400 mt-2 text-center max-w-md">
          You must be a department lead or admin to manage this department.
        </p>
        <Link href="/departments" className="mt-4">
          <Button variant="outline">Back to Departments</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/departments">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{department.icon}</span>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-clay-700">
                {department.name}
              </h1>
            </div>
            {department.description && (
              <p className="text-clay-500 text-sm mt-1 ml-10">
                {department.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="gold" onClick={() => setCreateTaskOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
          <Button variant="outline" onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-clay-700">{members.length}</p>
            <p className="text-xs text-clay-500">Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{todoTasks.length + inProgressTasks.length}</p>
            <p className="text-xs text-clay-500">Active Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{inProgressTasks.length}</p>
            <p className="text-xs text-clay-500">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{doneTasks.length}</p>
            <p className="text-xs text-clay-500">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-clay-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "tasks"
              ? "bg-white text-clay-700 shadow-sm"
              : "text-clay-500 hover:text-clay-700"
          }`}
        >
          Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "members"
              ? "bg-white text-clay-700 shadow-sm"
              : "text-clay-500 hover:text-clay-700"
          }`}
        >
          Members ({members.length})
        </button>
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-clay-300 mb-4" />
                <h3 className="text-lg font-display font-semibold text-clay-600">
                  No Tasks Yet
                </h3>
                <p className="text-clay-400 text-sm mt-1">
                  Create your first task to get started
                </p>
                <Button
                  variant="gold"
                  className="mt-4"
                  onClick={() => setCreateTaskOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* To Do */}
              {todoTasks.length > 0 && (
                <TaskSection
                  title="To Do"
                  tasks={todoTasks}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDelete={handleDeleteTask}
                  members={members}
                />
              )}

              {/* In Progress */}
              {inProgressTasks.length > 0 && (
                <TaskSection
                  title="In Progress"
                  tasks={inProgressTasks}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDelete={handleDeleteTask}
                  members={members}
                />
              )}

              {/* Done */}
              {doneTasks.length > 0 && (
                <TaskSection
                  title="Completed"
                  tasks={doneTasks}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDelete={handleDeleteTask}
                  members={members}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div>
          {members.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-clay-300 mb-4" />
                <h3 className="text-lg font-display font-semibold text-clay-600">
                  No Members Yet
                </h3>
                <p className="text-clay-400 text-sm mt-1">
                  Add members to this department to get started
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setAddMemberOpen(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
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
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-clay-700 truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-clay-400">
                              {member.role.replace(/_/g, " ")}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingMember === member.id}
                            className="text-clay-400 hover:text-red-500 h-8 w-8 p-0"
                            title="Remove from department"
                          >
                            {removingMember === member.id ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <UserMinus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
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
      )}

      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a new task for {department.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Title</Label>
              <Input
                id="taskTitle"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="taskDesc">Description (optional)</Label>
              <Textarea
                id="taskDesc"
                placeholder="Task description..."
                value={newTask.description}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(v) =>
                    setNewTask((prev) => ({
                      ...prev,
                      priority: v as TaskPriority,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taskDue">Due Date (optional)</Label>
                <Input
                  id="taskDue"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) =>
                    setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Assign To (optional)</Label>
              <Select
                value={newTask.assigneeId}
                onValueChange={(v) =>
                  setNewTask((prev) => ({ ...prev, assigneeId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateTaskOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleCreateTask}
              disabled={!newTask.title.trim() || creatingTask}
            >
              {creatingTask ? <LoadingSpinner size="sm" /> : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to {department.name}</DialogTitle>
            <DialogDescription>
              Search for a member to add to this department
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
                    : "All active members are in this department"}
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

// ─── Task Section Component ───

function TaskSection({
  title,
  tasks,
  onUpdateStatus,
  onDelete,
  members,
}: {
  title: string;
  tasks: DepartmentTask[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  members: User[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-clay-600 mb-3 uppercase tracking-wide">
        {title} ({tasks.length})
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => {
          const StatusIcon = statusIcons[task.status];
          const nextStatus: TaskStatus | null =
            task.status === "TODO"
              ? "IN_PROGRESS"
              : task.status === "IN_PROGRESS"
              ? "DONE"
              : null;

          return (
            <Card key={task.id} className={task.status === "DONE" ? "opacity-70" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      nextStatus && onUpdateStatus(task.id, nextStatus)
                    }
                    className={`mt-0.5 flex-shrink-0 ${
                      task.status === "DONE"
                        ? "text-green-500"
                        : task.status === "IN_PROGRESS"
                        ? "text-blue-500"
                        : "text-clay-400 hover:text-blue-500"
                    }`}
                    title={
                      nextStatus
                        ? `Move to ${nextStatus.replace("_", " ")}`
                        : "Completed"
                    }
                  >
                    <StatusIcon className="h-5 w-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`font-medium text-sm ${
                          task.status === "DONE"
                            ? "line-through text-clay-400"
                            : "text-clay-700"
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge
                          className={`text-xs ${priorityColors[task.priority]}`}
                        >
                          {task.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(task.id)}
                          className="text-clay-400 hover:text-red-500 h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs text-clay-500 mt-1">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-clay-400">
                      {task.assigneeName && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {task.assigneeName}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(task.dueDate, "MMM d, yyyy")}
                        </span>
                      )}
                      <span>
                        Created {format(task.createdAt, "MMM d")} by{" "}
                        {task.createdByName}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
