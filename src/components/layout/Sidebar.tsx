"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { UserCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { getVisibleNavEntries } from "@/components/layout/nav-config";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { useTransportAccess } from "@/hooks/useTransportAccess";
import { useMediaAccess } from "@/hooks/useMediaAccess";
import { useFoodAccess } from "@/hooks/useFoodAccess";

export function Sidebar() {
  const { userData, signOut } = useAuth();
  const { pagePermissions } = useAccessControl();
  const { canManage: canManageCamp } = useCampLeadAccess();
  const { canPlanBraai } = useFundraisingAccess();
  const { canManageTransport, canApproveAccounts } = useTransportAccess();
  const { canManageMedia } = useMediaAccess();
  const { canConfirmFood } = useFoodAccess();

  if (!userData) return null;

  const extraKeys: string[] = [];
  if (canManageCamp) extraKeys.push("rops_camp");
  if (canPlanBraai) extraKeys.push("fundraising");
  if (canManageTransport) extraKeys.push("transport_requests");
  if (canApproveAccounts) extraKeys.push("accounts_approvals");
  if (canManageMedia) extraKeys.push("media_requests");
  if (canConfirmFood) extraKeys.push("food_requests");
  const navEntries = getVisibleNavEntries(userData.role, pagePermissions, extraKeys);

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut();
  };

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-clay-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-clay-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/church-logo.png"
          alt="Tabernacle of David Assembly — City Mission Church"
          width={52}
          height={40}
          className="h-10 w-auto"
        />
        <h1 className="font-display text-lg text-clay-700">Dew of Hermon</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <SidebarNav entries={navEntries} />
      </nav>

      <Separator />

      {/* User section */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 text-gold-dark text-sm font-bold">
            {userData.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-clay-700 truncate">
              {userData.name}
            </p>
            <p className="text-xs text-clay-400 truncate">
              {userData.role.replace("_", " ")}
            </p>
          </div>
          <NotificationBell />
        </div>
        <div className="flex gap-2">
          <Link href="/profile" className="flex-1">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <UserCircle className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
