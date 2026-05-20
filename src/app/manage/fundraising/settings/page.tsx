"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RoleProtected } from "@/components/shared/RoleProtected";
import { useFundraisingAccess } from "@/hooks/useFundraisingAccess";
import { LoadingSpinner, PageLoader } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, EyeOff, Save, AlertCircle } from "lucide-react";
import {
  CAMPAIGN_NAME,
  CURRENCY_SYMBOL,
  FUNDRAISING_MENU_ITEMS,
} from "@/lib/fundraising-menu";
import type { FundraisingMenuItemDef } from "@/types";

interface MenuConfigDTO {
  items: {
    key: string;
    name: string;
    description: string;
    price: number;
    enabled: boolean;
  }[];
  momoNumber: string;
  currency: string;
  campaignName: string;
}

function FundraisingSettingsContent() {
  const { firebaseUser } = useAuth();
  const { canPlanBraai, loading: accessLoading } = useFundraisingAccess();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [momoNumber, setMomoNumber] = useState("");

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/fundraising/menu", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = (await res.json()) as MenuConfigDTO;
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      const initialPrices: Record<string, string> = {};
      const initialEnabled: Record<string, boolean> = {};
      data.items.forEach((i) => {
        initialPrices[i.key] = String(i.price);
        initialEnabled[i.key] = i.enabled;
      });
      setPrices(initialPrices);
      setEnabled(initialEnabled);
      setMomoNumber(data.momoNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || accessLoading || !canPlanBraai) return;
    load();
  }, [firebaseUser, accessLoading, canPlanBraai, load]);

  const handleSave = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const itemPrices: Record<string, number> = {};
      for (const [key, raw] of Object.entries(prices)) {
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0) {
          toast({
            title: "Invalid price",
            description: `Price for ${key} must be a non-negative number.`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        itemPrices[key] = Math.round(num);
      }
      const disabledItemKeys = Object.entries(enabled)
        .filter(([, on]) => !on)
        .map(([key]) => key);
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/fundraising/menu", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          itemPrices,
          disabledItemKeys,
          momoNumber: momoNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({
        title: "Saved",
        description: "Menu prices and MoMo number updated.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (accessLoading) return <PageLoader />;

  if (!canPlanBraai) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-display text-clay-700">Settings</h2>
          <p className="mt-2 text-clay-500">
            Only the Fundraising lead can edit menu prices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/manage/fundraising">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-700">
            Menu & Settings
          </h1>
          <p className="text-sm text-clay-500 mt-1">
            Edit the prices buyers see on the {CAMPAIGN_NAME} page, and the
            Mobile Money number used on receipts.
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="py-4 flex items-center gap-3 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="flex-1 text-sm">{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Menu</CardTitle>
              <p className="text-sm text-clay-500">
                Edit prices, and toggle whether each item is available on
                the public order page. Hidden items can be turned back on
                any time.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {FUNDRAISING_MENU_ITEMS.map((item) => {
                const isOn = enabled[item.key] ?? true;
                return (
                  <div
                    key={item.key}
                    className={`flex flex-wrap items-center gap-4 py-3 border-b border-clay-100 last:border-0 transition-opacity ${
                      isOn ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <SettingsItemThumb item={item} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-clay-700">
                            {item.name}
                          </p>
                          {!isOn && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full bg-clay-100 text-clay-500 px-2 py-0.5">
                              <EyeOff className="h-3 w-3" />
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-clay-400 truncate max-w-[420px]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-clay-500">
                          {CURRENCY_SYMBOL}
                        </span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100000}
                          value={prices[item.key] ?? ""}
                          onChange={(e) =>
                            setPrices((p) => ({
                              ...p,
                              [item.key]: e.target.value,
                            }))
                          }
                          disabled={!isOn}
                          className="w-24"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={isOn}
                          onCheckedChange={(v) =>
                            setEnabled((e) => ({ ...e, [item.key]: v }))
                          }
                          aria-label={`Toggle ${item.name} availability`}
                        />
                        <span className="text-xs text-clay-500 w-16">
                          {isOn ? "Available" : "Hidden"}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Mobile Money number
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="momo" className="text-clay-700">
                Number shown on the receipt
              </Label>
              <Input
                id="momo"
                type="tel"
                value={momoNumber}
                onChange={(e) => setMomoNumber(e.target.value)}
                placeholder="0979 414 477"
                className="mt-2 max-w-xs"
              />
              <p className="text-xs text-clay-400 mt-2">
                Buyers will copy this number to send payment. Spaces are
                stripped automatically when they tap &ldquo;Copy.&rdquo;
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="gold"
              className="gap-2"
            >
              {saving ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function FundraisingSettingsPage() {
  return (
    <RoleProtected pageKey="fundraising" fallback={<SettingsFallback />}>
      <FundraisingSettingsContent />
    </RoleProtected>
  );
}

function SettingsItemThumb({ item }: { item: FundraisingMenuItemDef }) {
  const [failed, setFailed] = useState(false);
  if (item.imagePath && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imagePath}
        alt={item.name}
        className="h-12 w-12 rounded-md object-cover bg-clay-100"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }
  return (
    <div className="h-12 w-12 rounded-md bg-cream border border-clay-200 flex items-center justify-center text-2xl" aria-hidden>
      {item.emoji}
    </div>
  );
}

function SettingsFallback() {
  const { canPlanBraai, loading } = useFundraisingAccess();
  if (loading) return <PageLoader />;
  if (canPlanBraai) return <FundraisingSettingsContent />;
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-display text-clay-700">Access Denied</h2>
        <p className="mt-2 text-clay-500">
          You don&apos;t have permission to edit fundraising settings.
        </p>
      </div>
    </div>
  );
}
