"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CAMPS } from "@/lib/camps";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Compass, ChevronLeft, ChevronRight, Tent } from "lucide-react";
import { format, parseISO } from "date-fns";

type Step = 1 | 2 | 3 | 4;

interface FormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "" | "MALE" | "FEMALE";
  phone: string;
  email: string;
  churchOrSchool: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes: string;
  tshirtSize: "" | "XS" | "S" | "M" | "L" | "XL" | "XXL";
  dietaryPreference: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  churchOrSchool: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalNotes: "",
  tshirtSize: "",
  dietaryPreference: "",
};

export default function RopsCampRegistrationPage() {
  const camp = CAMPS[0];
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);

  const refreshCapacity = useCallback(async () => {
    try {
      const res = await fetch(`/api/camp-registrations/capacity?campId=${camp.id}`);
      if (!res.ok) return;
      const json = await res.json();
      setRegisteredCount(json.registered);
    } catch {
      // ignore — capacity badge just won't show
    }
  }, [camp.id]);

  useEffect(() => {
    refreshCapacity();
    const t = setInterval(refreshCapacity, 30_000);
    return () => clearInterval(t);
  }, [refreshCapacity]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const personalValid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.dateOfBirth.trim() &&
    form.gender &&
    form.phone.trim() &&
    form.churchOrSchool.trim();

  const healthValid =
    form.emergencyContactName.trim() &&
    form.emergencyContactPhone.trim() &&
    form.tshirtSize;

  const canNext = (step === 1 && personalValid) || (step === 2 && healthValid) || step === 3;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/camp-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campId: camp.id,
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          phone: form.phone,
          email: form.email || undefined,
          churchOrSchool: form.churchOrSchool,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          medicalNotes: form.medicalNotes || undefined,
          tshirtSize: form.tshirtSize,
          dietaryPreference: form.dietaryPreference || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Registration failed",
          description: json.error || "Please check the form and try again.",
          variant: "destructive",
        });
        return;
      }
      setSubmittedId(json.registration.id);
      setStep(4);
      refreshCapacity();
    } catch (err) {
      toast({
        title: "Network error",
        description: "Unable to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const dateLabel = useMemo(() => {
    try {
      const start = format(parseISO(camp.startDate), "MMMM d");
      const endFmt = format(parseISO(camp.endDate), "d, yyyy");
      return `${start}–${endFmt}`;
    } catch {
      return `${camp.startDate} – ${camp.endDate}`;
    }
  }, [camp]);

  const capacityPct =
    registeredCount !== null
      ? Math.min(100, Math.round((registeredCount / camp.capacity) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-clay-500 text-sm mb-2">
              <Tent className="h-4 w-4" />
              <span>Dew of Hermon Youth Ministry</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-clay-800">
              {camp.name}
            </h1>
            <p className="text-clay-600 mt-1">{dateLabel} · Rites of Passage</p>
          </div>
          {registeredCount !== null && (
            <div className="text-right min-w-[180px]">
              <div className="text-xs uppercase tracking-wide text-clay-500">Capacity</div>
              <div className="font-display text-xl text-clay-800">
                {registeredCount} / {camp.capacity} spots
              </div>
              <Progress value={capacityPct} className="mt-2 h-2" />
            </div>
          )}
        </div>

        <StepIndicator step={step} />

        <Card className="mt-6">
          <CardContent className="p-6 md:p-8">
            {step === 1 && (
              <PersonalStep form={form} update={update} />
            )}
            {step === 2 && (
              <HealthStep form={form} update={update} />
            )}
            {step === 3 && (
              <PaymentStep camp={camp} />
            )}
            {step === 4 && submittedId && (
              <ConfirmStep camp={camp} regId={submittedId} form={form} />
            )}

            {step !== 4 && (
              <div className="mt-8 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                  disabled={step === 1 || submitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => setStep((s) => (s + 1) as Step)}
                    disabled={!canNext}
                  >
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="button" onClick={submit} disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit registration"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-clay-500">
          Already registered?{" "}
          <Link href="/login" className="text-teal hover:underline">
            Sign in
          </Link>{" "}
          to view your status.
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const labels = ["Personal", "Health", "Payment", "Confirm"];
  return (
    <div className="grid grid-cols-4 gap-2">
      {labels.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={label} className="flex flex-col items-center text-center">
            <div
              className={`text-sm font-medium ${
                active ? "text-teal" : done ? "text-clay-700" : "text-clay-400"
              }`}
            >
              {idx} {label}
            </div>
            <div
              className={`mt-2 h-0.5 w-full ${
                done ? "bg-teal" : active ? "bg-teal" : "bg-clay-200"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

function PersonalStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-clay-500">
          Personal information
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name">
          <Input
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="Mwansa"
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name">
          <Input
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Mulenga"
            autoComplete="family-name"
          />
        </Field>
        <Field label="Date of birth">
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.gender}
            onValueChange={(v) => update("gender", v as FormState["gender"])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Phone / WhatsApp">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+260 97 123 4567"
            autoComplete="tel"
          />
        </Field>
        <Field label="Email (optional)">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Church / school" className="md:col-span-2">
          <Input
            value={form.churchOrSchool}
            onChange={(e) => update("churchOrSchool", e.target.value)}
            placeholder="Tabernacle of David"
          />
        </Field>
      </div>
    </div>
  );
}

function HealthStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-clay-500">
          Health & emergency
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Emergency contact name">
          <Input
            value={form.emergencyContactName}
            onChange={(e) => update("emergencyContactName", e.target.value)}
            placeholder="Ruth Mulenga"
          />
        </Field>
        <Field label="Emergency phone">
          <Input
            type="tel"
            value={form.emergencyContactPhone}
            onChange={(e) => update("emergencyContactPhone", e.target.value)}
            placeholder="+260 96 765 4321"
          />
        </Field>
        <Field label="Medical conditions / allergies (optional)" className="md:col-span-2">
          <Textarea
            value={form.medicalNotes}
            onChange={(e) => update("medicalNotes", e.target.value)}
            placeholder="None reported"
            rows={3}
          />
        </Field>
        <Field label="T-shirt size">
          <Select
            value={form.tshirtSize}
            onValueChange={(v) => update("tshirtSize", v as FormState["tshirtSize"])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="XS">Extra Small (XS)</SelectItem>
              <SelectItem value="S">Small (S)</SelectItem>
              <SelectItem value="M">Medium (M)</SelectItem>
              <SelectItem value="L">Large (L)</SelectItem>
              <SelectItem value="XL">Extra Large (XL)</SelectItem>
              <SelectItem value="XXL">Double XL (XXL)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Dietary preference (optional)">
          <Input
            value={form.dietaryPreference}
            onChange={(e) => update("dietaryPreference", e.target.value)}
            placeholder="No restrictions"
          />
        </Field>
      </div>
    </div>
  );
}

function PaymentStep({ camp }: { camp: typeof CAMPS[number] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-clay-500">
          Payment
        </h2>
      </div>
      <div className="bg-clay-50 border border-clay-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-clay-600">Camp fee</span>
          <span className="font-display text-2xl text-clay-800">
            {camp.currency} {camp.fee.toLocaleString()}
          </span>
        </div>
        <p className="text-sm text-clay-600">
          Submitting this form reserves your spot as <Badge variant="outline">Unpaid</Badge>.
          Send your proof of payment to the camp coordinator on WhatsApp, and an admin will
          mark your registration as <strong>Paid</strong> once received. Spots are confirmed
          on payment.
        </p>
      </div>
      <div className="text-sm text-clay-500">
        By continuing you agree that the information you have provided is accurate and you
        are willing to abide by the camp guidelines.
      </div>
    </div>
  );
}

function ConfirmStep({
  camp,
  regId,
  form,
}: {
  camp: typeof CAMPS[number];
  regId: string;
  form: FormState;
}) {
  return (
    <div className="text-center py-6 space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-teal" />
      </div>
      <h2 className="font-display text-2xl text-clay-800">You’re registered!</h2>
      <p className="text-clay-600">
        Thanks {form.firstName}. Your reservation for <strong>{camp.name}</strong> has been
        received.
      </p>
      <div className="bg-clay-50 border border-clay-200 rounded-lg p-4 inline-block text-left">
        <div className="text-xs text-clay-500">Reference</div>
        <div className="font-mono text-sm text-clay-800">{regId}</div>
      </div>
      <p className="text-sm text-clay-600 max-w-md mx-auto">
        Send your proof of payment to the camp coordinator on WhatsApp. An admin will
        confirm your spot as paid in the system once received.
      </p>
      <div className="pt-4">
        <Link href="/">
          <Button variant="outline">
            <Compass className="h-4 w-4 mr-2" />
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-clay-700 mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
