"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Church,
  CircleDollarSign,
  Flame,
  Lock,
  MapPin,
  Sparkles,
  Tent,
  Users,
} from "lucide-react";
import { CAMPS } from "@/lib/camps";
import { useAuth } from "@/contexts/AuthContext";
import { useCampLeadAccess } from "@/hooks/useCampLeadAccess";
import { PaymentInstructionsCard } from "@/components/rops-camp/PaymentInstructionsCard";
import { RopsFontStyles } from "@/components/rops-camp/RopsFontStyles";

// ─── CONFIG ─────────────────────────────────────────────────────────
const camp = CAMPS[0];
const CAMP_FEE_ZMW = camp.fee;
const CAMP_DATES = "20 — 24 August 2026";
const VENUE = "Crested Crane Academy";
const CHURCH_ADDRESS = "Tabernacle of David Assembly, Lusaka";

// Camp photos served from public/rops-camp/.
const PHOTO_HERO = "/rops-camp/hero.jpg";
const PHOTO_GALLERY = [
  "/rops-camp/gallery-01.jpg",
  "/rops-camp/gallery-02.jpg",
  "/rops-camp/gallery-03.jpg",
  "/rops-camp/gallery-04.jpg",
  "/rops-camp/gallery-05.jpg",
  "/rops-camp/gallery-06.jpg",
  "/rops-camp/gallery-07.jpg",
];

// ─── FORM TYPES ─────────────────────────────────────────────────────
type RegistrantType = "self" | "other";

interface FormState {
  registrantType: RegistrantType;
  camperName: string;
  camperDob: string;
  camperGender: "" | "Male" | "Female";
  parentName: string;
  parentRelationship: string;
  parentPhone: string;
  parentAltPhone: string;
  parentEmail: string;
  address: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  dropoffLocation: "" | "church" | "campsite";
  notes: string;
  consent: boolean;
}

const INITIAL_FORM: FormState = {
  registrantType: "other",
  camperName: "",
  camperDob: "",
  camperGender: "",
  parentName: "",
  parentRelationship: "",
  parentPhone: "",
  parentAltPhone: "",
  parentEmail: "",
  address: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  allergies: "",
  medicalConditions: "",
  medications: "",
  dropoffLocation: "",
  notes: "",
  consent: false,
};

interface SubmittedRegistration {
  id: string;
  camperName: string;
  parentEmail: string;
  claimToken: string;
}

const PENDING_CLAIM_KEY = "ropsPendingClaim";

// ─── ROOT PAGE ──────────────────────────────────────────────────────
export default function RopsCampPage() {
  const [view, setView] = useState<"register" | "admin-gate">("register");
  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch(
          `/api/camp-registrations/capacity?campId=${camp.id}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setRegisteredCount(json.registered ?? 0);
      } catch {
        // capacity badge is best-effort
      }
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="font-body bg-rops-cream min-h-screen text-rops-ink">
      <RopsFontStyles />

      {view === "register" && (
        <>
          <Hero
            registeredCount={registeredCount}
            onRegisterClick={() =>
              formRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            onAdminClick={() => setView("admin-gate")}
          />
          <Glimpses />
          <RegistrationForm
            formRef={formRef}
            onSubmitted={() => setRegisteredCount((c) => c + 1)}
          />
          <Footer onAdminClick={() => setView("admin-gate")} />
        </>
      )}

      {view === "admin-gate" && (
        <AdminGate onBack={() => setView("register")} />
      )}
    </div>
  );
}

// ─── ADMIN GATE ─────────────────────────────────────────────────────
function AdminGate({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { userData, loading: authLoading } = useAuth();
  const { loading: accessLoading, canManage } = useCampLeadAccess();
  const [proceeding, setProceeding] = useState(false);

  const loading = authLoading || (userData && accessLoading);

  return (
    <section className="bg-rops-ink min-h-screen flex items-center px-6">
      <div className="max-w-sm mx-auto w-full">
        <button
          onClick={onBack}
          className="font-body text-[11px] uppercase tracking-[0.2em] text-rops-taupe hover:text-rops-cream flex items-center gap-1.5 mb-12 transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <Flame
          size={24}
          className="text-rops-ember mb-6 flame-flicker"
          fill="currentColor"
        />
        <h2 className="font-display text-rops-cream text-4xl tracking-tight mb-2">
          Admin <span className="italic">access</span>
        </h2>

        {loading ? (
          <p className="font-body text-rops-taupe text-sm">Checking access…</p>
        ) : !userData ? (
          <>
            <p className="font-body text-rops-taupe text-sm mb-8">
              Sign in with your admin account to view and manage registrations.
            </p>
            <button
              onClick={() => router.push("/login?redirect=/manage/rops-camp")}
              className="w-full bg-rops-ember hover:bg-rops-ember-2 text-rops-cream py-3.5 rounded-full font-body text-[13px] uppercase tracking-[0.18em] transition-colors"
            >
              Sign in
            </button>
          </>
        ) : canManage ? (
          <>
            <p className="font-body text-rops-taupe text-sm mb-2">
              Signed in as{" "}
              <span className="text-rops-cream">
                {userData.name || userData.email}
              </span>
            </p>
            <p className="font-body text-rops-taupe text-sm mb-8">
              Continue to the registrations dashboard.
            </p>
            <button
              onClick={() => {
                setProceeding(true);
                router.push("/manage/rops-camp");
              }}
              disabled={proceeding}
              className="w-full bg-rops-ember hover:bg-rops-ember-2 disabled:opacity-50 text-rops-cream py-3.5 rounded-full font-body text-[13px] uppercase tracking-[0.18em] transition-colors inline-flex items-center justify-center gap-2"
            >
              {proceeding ? "Loading…" : "Proceed as Admin"}
              {!proceeding && <ArrowRight size={14} />}
            </button>
          </>
        ) : (
          <>
            <p className="font-body text-rops-taupe text-sm mb-2">
              Signed in as{" "}
              <span className="text-rops-cream">
                {userData.name || userData.email}
              </span>
            </p>
            <div className="mt-2 mb-6 flex items-start gap-2 font-body text-[13px] text-rops-ember">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                This account does not have admin access to ROPs Camp
                registrations.
              </span>
            </div>
            <button
              onClick={onBack}
              className="w-full border border-rops-taupe/40 text-rops-cream py-3.5 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:border-rops-cream transition-colors"
            >
              Back to registration
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ─── HERO ───────────────────────────────────────────────────────────
function Hero({
  registeredCount,
  onRegisterClick,
  onAdminClick,
}: {
  registeredCount: number;
  onRegisterClick: () => void;
  onAdminClick: () => void;
}) {
  const { firebaseUser, loading: authLoading } = useAuth();
  return (
    <header className="relative overflow-hidden bg-rops-cream rops-grain">
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Flame
            size={20}
            className="text-rops-ember flame-flicker"
            strokeWidth={2}
            fill="currentColor"
          />
          <span className="font-display italic text-sm tracking-wide text-rops-ink">
            Dew of Hermon · Tabernacle of David
          </span>
        </div>
        <div className="flex items-center gap-5">
          {!authLoading && firebaseUser ? (
            <Link
              href="/dashboard"
              className="font-body text-[11px] uppercase tracking-[0.18em] text-rops-taupe hover:text-rops-ink flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={12} /> Dashboard
            </Link>
          ) : null}
          <button
            onClick={onAdminClick}
            className="font-body text-[11px] uppercase tracking-[0.18em] text-rops-taupe hover:text-rops-ink flex items-center gap-1.5 transition-colors"
          >
            <Lock size={12} /> Admin
          </button>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 md:px-10 pt-10 md:pt-16 pb-12 md:pb-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 min-w-0">
            <div className="rise rise-1 flex items-center gap-3 mb-6">
              <div className="h-px w-10 bg-rops-ember" />
              <span className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember">
                Rites of Passage · Camp X
              </span>
            </div>
            <h1 className="rise rise-2 font-display text-rops-ink leading-[0.92] text-rops-h1 font-medium tracking-[-0.02em]">
              The
              <span className="italic text-rops-ember"> passage </span>
              <br />
              begins.
            </h1>
            <p className="rise rise-3 mt-8 font-body text-rops-ink-2 text-lg max-w-xl leading-relaxed">
              It&rsquo;s that session again.
            </p>
            <p className="rise rise-3 mt-4 font-body text-rops-ink-2 text-lg max-w-xl leading-relaxed">
              Three days. One question that never gets old: who are you
              becoming? ROPs X is where boys and girls don&rsquo;t just attend
              camp. They cross a threshold. Into purpose. Into maturity. Into
              the person God always meant them to be.
            </p>

            <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={onRegisterClick}
                className="group inline-flex items-center gap-3 bg-rops-ink text-rops-cream py-4 px-7 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors ember-glow"
              >
                Register for Camp
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
              <Link
                href="/rops-camp/my-registrations"
                className="font-body text-[11px] uppercase tracking-[0.18em] text-rops-ink/70 hover:text-rops-ember transition-colors inline-flex items-center gap-1.5"
              >
                Already registered? View status
                <ArrowRight size={12} />
              </Link>
              <div className="font-body text-xs text-rops-taupe number-tag">
                <span className="text-rops-ink font-semibold">
                  {registeredCount}
                </span>{" "}
                campers registered so far
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rise rise-5 min-w-0">
            <div className="relative max-w-md mx-auto lg:max-w-none lg:mx-0">
              <div className="relative overflow-hidden bg-rops-ink aspect-[4/5] md:aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={PHOTO_HERO}
                  alt="Out of the shadows — ROPs IX"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 grad-ink-30-up pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <span className="font-display italic text-rops-cream text-sm leading-tight max-w-[60%]">
                    &ldquo;Out of the shadows.&rdquo;
                  </span>
                  <span className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-cream/70 number-tag">
                    ROPs IX · 2025
                  </span>
                </div>
              </div>
              <div className="absolute -top-3 -left-3 md:-top-4 md:-left-4 bg-rops-ember text-rops-cream font-display italic text-2xl md:text-3xl w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center number-tag ember-glow">
                X
              </div>
            </div>
          </div>
        </div>

        <div className="rise rise-5 mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6 border-t border-rops-line pt-8">
          <DossierLine
            icon={<CalendarDays size={14} />}
            label="Dates"
            value={CAMP_DATES}
          />
          <DossierLine
            icon={<MapPin size={14} />}
            label="Venue"
            value={VENUE}
          />
          <DossierLine
            icon={<Users size={14} />}
            label="Ages"
            value="12 — 35 years"
          />
          <DossierLine
            icon={<CircleDollarSign size={14} />}
            label="Camp Fee"
            value={`ZMW ${CAMP_FEE_ZMW.toLocaleString()}`}
          />
        </div>
      </div>

      <div className="relative border-y border-rops-line bg-rops-cream-2 overflow-hidden marquee-mask">
        <div className="flex gap-12 py-3 whitespace-nowrap font-display italic text-rops-ink/70">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="text-lg flex items-center gap-12 shrink-0"
            >
              <span>grow</span>
              <Sparkles size={14} className="text-rops-ember" />
              <span>worship</span>
              <Sparkles size={14} className="text-rops-ember" />
              <span>belong</span>
              <Sparkles size={14} className="text-rops-ember" />
              <span>become</span>
              <Sparkles size={14} className="text-rops-ember" />
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

function DossierLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-rops-taupe mb-0.5">
        {icon}
        <span className="font-body text-[10px] uppercase tracking-[0.2em]">
          {label}
        </span>
      </div>
      <div className="font-display text-rops-ink text-lg leading-tight">
        {value}
      </div>
    </div>
  );
}

// ─── GLIMPSES ───────────────────────────────────────────────────────
function Glimpses() {
  return (
    <section className="bg-rops-cream-2 py-20 md:py-28 px-6 md:px-10 rops-grain">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-6 mb-12 lg:mb-16 items-end">
          <div className="lg:col-span-7 min-w-0">
            <div className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
              Glimpses · From the last passage
            </div>
            <h2 className="font-display text-rops-ink text-3xl sm:text-4xl lg:text-6xl tracking-tight leading-[1.02]">
              Three days.
              <span className="italic"> You&rsquo;ll feel it on day one.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 min-w-0">
            <p className="font-body text-rops-ink-2 text-base leading-relaxed">
              These are real moments from previous ROPS. Early energetic
              mornings, competitive sports, nshima that somehow tastes better
              at camp, powerful praise and worship, and nights that go long
              for all the right reasons. It&rsquo;s fun out here.
            </p>
          </div>
        </div>

        <figure className="mb-6 md:mb-8">
          <div className="relative overflow-hidden bg-rops-ink aspect-[16/9] md:aspect-[21/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PHOTO_GALLERY[0]}
              alt="Mornings — the mountain rises early"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <figcaption className="mt-3 flex items-baseline justify-between gap-4">
            <span className="font-display italic text-rops-ink text-xl">
              <span className="text-rops-ember number-tag mr-2">01.</span>
              Mornings — the mountain rises early
            </span>
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-taupe hidden sm:block">
              physical training
            </span>
          </figcaption>
        </figure>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <GalleryTile
            src={PHOTO_GALLERY[1]}
            alt="Brotherhood over nshima"
            number="02."
            title="Brotherhood over nshima"
            tag="fellowship"
          />
          <GalleryTile
            src={PHOTO_GALLERY[2]}
            alt="Open palms in worship"
            number="03."
            title="Open palms"
            tag="worship"
          />
          <GalleryTile
            src={PHOTO_GALLERY[3]}
            alt="Sitting under elders"
            number="04."
            title="Sitting under elders"
            tag="teaching"
          />
        </div>

        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <figure className="lg:col-span-4 min-w-0">
            <div className="relative overflow-hidden bg-rops-ink aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTO_GALLERY[4]}
                alt="The team behind the fire"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <figcaption className="mt-3">
              <span className="font-display italic text-rops-ink text-lg">
                <span className="text-rops-ember number-tag mr-2">05.</span>
                The team behind the fire
              </span>
            </figcaption>
          </figure>
          <figure className="lg:col-span-8 min-w-0">
            <div className="relative overflow-hidden bg-rops-ink aspect-[16/10]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTO_GALLERY[5]}
                alt="When the room becomes holy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <figcaption className="mt-3 flex items-baseline justify-between gap-4">
              <span className="font-display italic text-rops-ink text-lg">
                <span className="text-rops-ember number-tag mr-2">06.</span>
                When the room becomes holy
              </span>
              <span className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-taupe hidden sm:block">
                evening service
              </span>
            </figcaption>
          </figure>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          <figure className="lg:col-span-5 order-2 lg:order-1 min-w-0">
            <div className="relative overflow-hidden bg-rops-ink aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTO_GALLERY[6]}
                alt="Joy is part of the journey"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <figcaption className="mt-3">
              <span className="font-display italic text-rops-ink text-lg">
                <span className="text-rops-ember number-tag mr-2">07.</span>
                Joy is part of the journey
              </span>
            </figcaption>
          </figure>
          <div className="lg:col-span-7 order-1 lg:order-2 min-w-0">
            <div className="font-display italic text-rops-ink text-xl sm:text-2xl lg:text-4xl leading-[1.15] tracking-tight">
              &ldquo;He brought me out into a spacious place;
              <span className="text-rops-ember"> he rescued me</span> because
              he delighted in me.&rdquo;
            </div>
            <div className="mt-5 font-body text-[11px] uppercase tracking-[0.22em] text-rops-taupe">
              Psalm 18 : 19
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GalleryTile({
  src,
  alt,
  number,
  title,
  tag,
}: {
  src: string;
  alt: string;
  number: string;
  title: string;
  tag: string;
}) {
  return (
    <figure>
      <div className="relative overflow-hidden bg-rops-ink aspect-[3/2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-[1.03]"
        />
      </div>
      <figcaption className="mt-3 flex items-baseline justify-between gap-3">
        <span className="font-display italic text-rops-ink text-lg leading-tight">
          <span className="text-rops-ember number-tag mr-2">{number}</span>
          {title}
        </span>
        <span className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-taupe hidden sm:block">
          {tag}
        </span>
      </figcaption>
    </figure>
  );
}

// ─── REGISTRATION FORM ─────────────────────────────────────────────
function RegistrationForm({
  formRef,
  onSubmitted,
}: {
  formRef: React.MutableRefObject<HTMLDivElement | null>;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {}
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedRegistration | null>(
    null
  );

  const isSelf = form.registrantType === "self";

  const set =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = e.target as HTMLInputElement;
      const value =
        target.type === "checkbox" ? target.checked : target.value;
      setForm((f) => ({ ...f, [key]: value as FormState[K] }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };

  const validate = () => {
    const err: Partial<Record<keyof FormState, string>> = {};
    if (!form.camperName.trim())
      err.camperName = isSelf
        ? "Your name is required"
        : "Camper name is required";
    if (!form.camperDob) err.camperDob = "Date of birth is required";
    if (!form.camperGender) err.camperGender = "Please select";
    if (!form.parentName.trim())
      err.parentName = isSelf
        ? "Your name is required"
        : "Parent/guardian name required";
    if (!form.parentPhone.trim()) err.parentPhone = "Primary phone required";
    if (form.parentEmail && !/^\S+@\S+\.\S+$/.test(form.parentEmail))
      err.parentEmail = "Enter a valid email";
    if (!form.emergencyName.trim())
      err.emergencyName = "Emergency contact required";
    if (!form.emergencyPhone.trim())
      err.emergencyPhone = "Emergency phone required";
    if (!form.dropoffLocation)
      err.dropoffLocation = "Choose a drop-off location";
    if (!form.consent)
      err.consent = isSelf
        ? "Your consent is required"
        : "Parent/guardian consent is required";
    return err;
  };

  const handleSubmit = async () => {
    setServerError(null);
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length > 0) {
      const firstKey = Object.keys(err)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const nameParts = form.camperName.trim().split(/\s+/);
      const firstName = nameParts.shift() || form.camperName.trim();
      const lastName = nameParts.join(" ") || firstName;

      const medicalSummary = [
        form.allergies && `Allergies: ${form.allergies}`,
        form.medicalConditions &&
          `Medical conditions: ${form.medicalConditions}`,
        form.medications && `Medications: ${form.medications}`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/camp-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campId: camp.id,
          registrantType: form.registrantType,
          firstName,
          lastName,
          dateOfBirth: form.camperDob,
          gender: form.camperGender === "Male" ? "MALE" : "FEMALE",
          phone: form.parentPhone,
          email: form.parentEmail || undefined,
          emergencyContactName: form.emergencyName,
          emergencyContactPhone: form.emergencyPhone,
          emergencyContactRelationship: form.emergencyRelationship || undefined,
          medicalNotes: medicalSummary || undefined,
          allergies: form.allergies || undefined,
          medications: form.medications || undefined,
          parentName: form.parentName,
          parentRelationship: form.parentRelationship || undefined,
          parentAltPhone: form.parentAltPhone || undefined,
          parentEmail: form.parentEmail || undefined,
          address: form.address || undefined,
          dropoffLocation: form.dropoffLocation.toUpperCase(),
          notes: form.notes || undefined,
          consentGiven: form.consent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(
          json.error ||
            "We couldn't save your registration. Please try again."
        );
        return;
      }
      setSubmitted({
        id: json.registration.id,
        camperName: form.camperName,
        parentEmail: form.parentEmail,
        claimToken: json.claimToken ?? "",
      });
      onSubmitted();
    } catch {
      setServerError(
        "Network error — please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Confirmation
        reg={submitted}
        onAnother={() => {
          setSubmitted(null);
          setForm(INITIAL_FORM);
          setErrors({});
          setServerError(null);
        }}
      />
    );
  }

  return (
    <section ref={formRef} className="bg-rops-cream py-20 px-6 md:px-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 text-center">
          <div className="font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
            Camper Registration
          </div>
          <h2 className="font-display text-rops-ink text-4xl md:text-5xl tracking-tight">
            Reserve a place
            <span className="italic"> in camp!</span>
          </h2>
          <p className="font-body text-rops-ink-2 mt-4 max-w-xl mx-auto">
            Fill in the details below. After submission you&rsquo;ll receive
            payment instructions — send proof of payment together with your
            generated reference number and we&rsquo;ll mark your slot as
            confirmed.
          </p>
        </div>

        {/* SECTION 0 — WHO'S FILLING THIS OUT */}
        <div className="mb-12">
          <SectionHeader
            number="00"
            title="Who&rsquo;s filling this out?"
            sub="So we know how to address you."
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {(["self", "other"] as RegistrantType[]).map((t) => {
              const selected = form.registrantType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, registrantType: t }))
                  }
                  className={
                    "text-left p-5 rounded-sm border-[1.5px] transition-all " +
                    (selected
                      ? "border-rops-ember bg-rops-cream-2 ember-glow"
                      : "border-rops-line hover:border-rops-ink bg-transparent")
                  }
                >
                  <div className="font-display text-rops-ink text-lg tracking-tight">
                    {t === "self"
                      ? "I am the camper"
                      : "I'm registering someone else"}
                  </div>
                  <div className="font-body text-[13px] text-rops-ink-2 mt-1 leading-relaxed">
                    {t === "self"
                      ? "You're filling this in for yourself."
                      : "You're filling this in for your child or someone you bring."}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 1 — CAMPER */}
        <div className="mb-12">
          <SectionHeader
            number="01"
            title={isSelf ? "Your Details" : "The Camper"}
            sub={
              isSelf
                ? "Tell us a bit about yourself."
                : "Tell us about the young person attending."
            }
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div data-field="camperName" className="md:col-span-2">
              <Field
                label="Full Name"
                required
                error={errors.camperName}
              >
                <TextInput
                  value={form.camperName}
                  onChange={set("camperName")}
                  placeholder="e.g. Tamara Banda"
                />
              </Field>
            </div>
            <div data-field="camperDob">
              <Field label="Date of Birth" required error={errors.camperDob}>
                <TextInput
                  type="date"
                  value={form.camperDob}
                  onChange={set("camperDob")}
                />
              </Field>
            </div>
            <div data-field="camperGender">
              <Field label="Gender" required error={errors.camperGender}>
                <SelectField
                  value={form.camperGender}
                  onChange={set("camperGender")}
                  options={["Male", "Female"]}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* SECTION 2 — CONTACT */}
        <div className="mb-12">
          <SectionHeader
            number="02"
            title={isSelf ? "Your Contact" : "Parent / Guardian"}
            sub={
              isSelf
                ? "How we'll get in touch with you about this registration."
                : "Who is registering this camper?"
            }
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div
              data-field="parentName"
              className={isSelf ? "md:col-span-2" : ""}
            >
              <Field
                label="Full Name"
                required
                error={errors.parentName}
              >
                <TextInput
                  value={form.parentName}
                  onChange={set("parentName")}
                />
              </Field>
            </div>
            {!isSelf && (
              <Field label="Relationship to Camper">
                <SelectField
                  value={form.parentRelationship}
                  onChange={set("parentRelationship")}
                  options={[
                    "Mother",
                    "Father",
                    "Guardian",
                    "Aunt",
                    "Uncle",
                    "Grandparent",
                    "Other",
                  ]}
                />
              </Field>
            )}
            <div data-field="parentPhone">
              <Field
                label="Primary Phone"
                required
                error={errors.parentPhone}
              >
                <TextInput
                  type="tel"
                  value={form.parentPhone}
                  onChange={set("parentPhone")}
                  placeholder="+260 9..."
                />
              </Field>
            </div>
            <Field label="Alternative Phone">
              <TextInput
                type="tel"
                value={form.parentAltPhone}
                onChange={set("parentAltPhone")}
              />
            </Field>
            <div data-field="parentEmail" className="md:col-span-2">
              <Field label="Email" error={errors.parentEmail}>
                <TextInput
                  type="email"
                  value={form.parentEmail}
                  onChange={set("parentEmail")}
                  placeholder={
                    isSelf ? "you@example.com" : "parent@example.com"
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Home Address">
                <TextInput
                  value={form.address}
                  onChange={set("address")}
                  placeholder="House/Plot No., Area, City"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* SECTION 3 — EMERGENCY */}
        <div className="mb-12">
          <SectionHeader
            number="03"
            title="Emergency Contact"
            sub={
              isSelf
                ? "Someone we can reach if you can't be reached."
                : "Someone we can reach if the parent/guardian is unavailable."
            }
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div data-field="emergencyName">
              <Field label="Full Name" required error={errors.emergencyName}>
                <TextInput
                  value={form.emergencyName}
                  onChange={set("emergencyName")}
                />
              </Field>
            </div>
            <Field label="Relationship">
              <TextInput
                value={form.emergencyRelationship}
                onChange={set("emergencyRelationship")}
              />
            </Field>
            <div data-field="emergencyPhone" className="md:col-span-2">
              <Field
                label="Phone Number"
                required
                error={errors.emergencyPhone}
              >
                <TextInput
                  type="tel"
                  value={form.emergencyPhone}
                  onChange={set("emergencyPhone")}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* SECTION 4 — HEALTH */}
        <div className="mb-12">
          <SectionHeader
            number="04"
            title="Health Information"
            sub={
              isSelf
                ? "Help our team care well for you. Leave blank if none."
                : "Help our team care well for the camper. Leave blank if none."
            }
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <Field label="Allergies">
              <TextAreaInput
                value={form.allergies}
                onChange={set("allergies")}
                placeholder="Foods, medication, environmental..."
              />
            </Field>
            <Field label="Medical Conditions">
              <TextAreaInput
                value={form.medicalConditions}
                onChange={set("medicalConditions")}
                placeholder="Asthma, diabetes, etc."
              />
            </Field>
            <div className="md:col-span-2">
              <Field
                label="Medications"
                help="dosage and timing if applicable"
              >
                <TextAreaInput
                  value={form.medications}
                  onChange={set("medications")}
                  placeholder="List any medications the camper takes daily..."
                />
              </Field>
            </div>
          </div>
        </div>

        {/* SECTION 5 — DROP-OFF */}
        <div className="mb-12">
          <SectionHeader
            number="05"
            title={isSelf ? "Where You're Coming From" : "Drop-off Location"}
            sub={
              isSelf
                ? "Where will you join us from on day one?"
                : "Where would you like to drop your camper for transport to camp?"
            }
          />
          <div
            data-field="dropoffLocation"
            className="grid md:grid-cols-2 gap-4"
          >
            <DropoffOption
              selected={form.dropoffLocation === "church"}
              onClick={() =>
                setForm((f) => ({ ...f, dropoffLocation: "church" }))
              }
              icon={<Church size={32} strokeWidth={1.4} />}
              title={isSelf ? "From the Church" : "At the Church"}
              meta={CHURCH_ADDRESS}
              detail="The team will travel together to the campsite as a group."
            />
            <DropoffOption
              selected={form.dropoffLocation === "campsite"}
              onClick={() =>
                setForm((f) => ({ ...f, dropoffLocation: "campsite" }))
              }
              icon={<Tent size={32} strokeWidth={1.4} />}
              title={isSelf ? "Direct to Camp Site" : "At the Camp Site"}
              meta={VENUE}
              detail={
                isSelf
                  ? "You'll travel directly to the camp venue."
                  : "You will drive your camper directly to the camp venue."
              }
            />
          </div>
          {errors.dropoffLocation && (
            <div className="mt-2 flex items-center gap-1 font-body text-xs text-rops-ember">
              <AlertCircle size={12} />
              <span>{errors.dropoffLocation}</span>
            </div>
          )}
        </div>

        {/* SECTION 6 — NOTES & CONSENT */}
        <div className="mb-12">
          <SectionHeader
            number="06"
            title="Anything Else"
            sub="Special requests or things we should know."
          />
          <Field label="Notes" help="optional">
            <TextAreaInput
              value={form.notes}
              onChange={set("notes")}
              rows={4}
              placeholder="Dietary preferences, traveling with a sibling, etc."
            />
          </Field>

          <div data-field="consent" className="mt-8 border-t border-rops-line pt-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <span
                className={
                  "mt-0.5 w-5 h-5 rounded-sm border-[1.5px] flex items-center justify-center shrink-0 transition-colors " +
                  (form.consent
                    ? "bg-rops-ink border-rops-ink"
                    : "bg-transparent border-rops-taupe group-hover:border-rops-ink")
                }
              >
                {form.consent && (
                  <Check size={13} className="text-rops-cream" strokeWidth={3} />
                )}
              </span>
              <input
                type="checkbox"
                className="hidden"
                checked={form.consent}
                onChange={set("consent")}
              />
              <span className="font-body text-sm text-rops-ink-2 leading-relaxed">
                {isSelf ? (
                  <>
                    I give my consent to attend ROPs X 2026, and I confirm
                    that the information provided is true and complete. I
                    understand that{" "}
                    <span className="font-medium">
                      registration is confirmed only upon receipt of payment
                    </span>
                    .
                  </>
                ) : (
                  <>
                    As parent/guardian I give my consent for the camper to
                    attend ROPs X 2026, and I confirm that the information
                    provided is true and complete. I understand that{" "}
                    <span className="font-medium">
                      registration is confirmed only upon receipt of payment
                    </span>
                    .
                  </>
                )}
              </span>
            </label>
            {errors.consent && (
              <div className="ml-8 mt-2 flex items-center gap-1 font-body text-xs text-rops-ember">
                <AlertCircle size={12} />
                <span>{errors.consent}</span>
              </div>
            )}
          </div>
        </div>

        {serverError && (
          <div className="mb-6 flex items-start gap-2 font-body text-sm text-rops-ember bg-rops-ember/5 border border-rops-ember/30 px-4 py-3 rounded-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-rops-line pt-8">
          <div className="font-body text-xs text-rops-taupe max-w-sm">
            Once submitted, you&rsquo;ll see payment details. Send your mobile
            money payment and proof to{" "}
            <span className="text-rops-ink font-semibold">0975088939</span> —
            your status will update to{" "}
            <span className="text-rops-forest font-semibold">paid</span> once
            it&rsquo;s received.
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="group inline-flex items-center gap-3 bg-rops-ember hover:bg-rops-ember-2 disabled:opacity-50 text-rops-cream py-4 px-9 rounded-full font-body text-[13px] uppercase tracking-[0.18em] transition-colors ember-glow shrink-0"
          >
            {submitting ? "Submitting..." : "Submit Registration"}
            {!submitting && (
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function DropoffOption({
  selected,
  onClick,
  icon,
  title,
  meta,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  meta: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group text-left p-6 rounded-sm border-[1.5px] transition-all " +
        (selected
          ? "border-rops-ember bg-rops-cream-2 ember-glow"
          : "border-rops-line hover:border-rops-ink bg-transparent")
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={
            "transition-colors " +
            (selected ? "text-rops-ember" : "text-rops-ink-2")
          }
        >
          {icon}
        </div>
        <div
          className={
            "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors " +
            (selected
              ? "bg-rops-ember border-rops-ember"
              : "border-rops-taupe")
          }
        >
          {selected && (
            <Check size={12} className="text-rops-cream" strokeWidth={3} />
          )}
        </div>
      </div>
      <div className="font-display text-rops-ink text-xl tracking-tight">
        {title}
      </div>
      <div className="font-body text-xs uppercase tracking-[0.16em] text-rops-ember mt-1">
        {meta}
      </div>
      <div className="font-body text-[13px] text-rops-ink-2 mt-3 leading-relaxed">
        {detail}
      </div>
    </button>
  );
}

// ─── CONFIRMATION ──────────────────────────────────────────────────
function Confirmation({
  reg,
  onAnother,
}: {
  reg: SubmittedRegistration;
  onAnother: () => void;
}) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const firstName = reg.camperName.split(/\s+/)[0] || reg.camperName;
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (reg.claimToken && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          PENDING_CLAIM_KEY,
          JSON.stringify({ id: reg.id, claimToken: reg.claimToken })
        );
      } catch {
        // sessionStorage may be unavailable (private mode, etc.) — fail silently
      }
    }
  }, [reg.id, reg.claimToken]);

  return (
    <section
      ref={sectionRef}
      className="bg-rops-cream py-24 px-6 md:px-10 rops-grain min-h-[80vh] flex items-center"
    >
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rops-forest mb-8 rise rise-1">
          <Check size={36} className="text-rops-cream" strokeWidth={2.5} />
        </div>
        <div className="rise rise-2 font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
          Registration Received
        </div>
        <h2 className="rise rise-2 font-display text-rops-ink text-5xl tracking-tight mb-4">
          See you at<span className="italic"> ROPs X,</span>
          <br />
          {firstName}!
        </h2>
        <p className="rise rise-3 font-body text-rops-ink-2 mt-6 text-lg leading-relaxed">
          Your slot has been reserved. Please complete payment within{" "}
          <span className="font-semibold">7 days</span> to confirm.
        </p>

        <div className="rise rise-4 mt-10">
          <PaymentInstructionsCard
            registrationId={reg.id}
            amount={CAMP_FEE_ZMW}
            currency={camp.currency}
            camperName={reg.camperName}
          />
        </div>

        <div className="rise rise-5 mt-10 flex flex-col items-center gap-4">
          {!authLoading && firebaseUser ? (
            <Link
              href="/rops-camp/my-registrations"
              className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-3.5 px-7 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
            >
              View my registrations
              <ArrowRight size={14} />
            </Link>
          ) : !authLoading ? (
            <Link
              href={`/register?next=${encodeURIComponent(
                "/rops-camp/my-registrations"
              )}${
                reg.parentEmail
                  ? `&email=${encodeURIComponent(reg.parentEmail)}`
                  : ""
              }`}
              className="inline-flex items-center gap-2 bg-rops-ink text-rops-cream py-3.5 px-7 rounded-full font-body text-[13px] uppercase tracking-[0.18em] hover:bg-rops-ember transition-colors"
            >
              Create an account to track this
              <ArrowRight size={14} />
            </Link>
          ) : null}

          <button
            onClick={onAnother}
            className="inline-flex items-center gap-2 font-body text-[13px] uppercase tracking-[0.18em] text-rops-ink hover:text-rops-ember transition-colors"
          >
            <ArrowLeft size={14} /> Register another camper
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────
function Footer({ onAdminClick }: { onAdminClick: () => void }) {
  return (
    <footer className="bg-rops-ink text-rops-cream">
      <div className="relative h-40 md:h-56 overflow-hidden border-b border-rops-taupe/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PHOTO_HERO}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 grad-footer-up" />
        <div className="absolute inset-0 flex items-end justify-center pb-6">
          <span className="font-display italic text-rops-cream text-2xl md:text-3xl tracking-tight">
            See you at ROPs X.
          </span>
        </div>
      </div>
      <div className="px-6 md:px-10 py-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 items-start">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Flame
                size={18}
                className="text-rops-ember flame-flicker"
                fill="currentColor"
              />
              <span className="font-display italic text-base">
                ROPs X · 2026
              </span>
            </div>
            <p className="font-body text-[13px] text-rops-taupe leading-relaxed">
              Dew of Hermon Youth Ministry · Tabernacle of David Assembly. The
              Rites of Passage camp shapes the next generation of worshippers
              and leaders.
            </p>
          </div>
          <div>
            <div className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-ember mb-3">
              When &amp; Where
            </div>
            <div className="font-body text-sm space-y-1.5 text-rops-cream">
              <div>{CAMP_DATES}</div>
              <div className="text-rops-taupe">{VENUE}</div>
            </div>
          </div>
          <div>
            <div className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-ember mb-3">
              Questions?
            </div>
            <div className="font-body text-sm text-rops-cream">
              Reach the camp team on{" "}
              <span className="font-semibold">0975088939</span>.
            </div>
            <button
              onClick={onAdminClick}
              className="mt-4 font-body text-[10px] uppercase tracking-[0.2em] text-rops-taupe hover:text-rops-cream inline-flex items-center gap-1.5 transition-colors"
            >
              <Lock size={11} /> Admin sign in
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-rops-taupe/20 flex flex-wrap items-center justify-between gap-3 font-body text-[10px] text-rops-taupe">
          <div>© 2026 Dew of Hermon Youth Ministry. All rights reserved.</div>
          <div className="italic">
            Sustaining excellence — from compliance to culture.
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── REUSABLE PIECES ───────────────────────────────────────────────
function Field({
  label,
  required,
  children,
  help,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  help?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-body text-[10px] uppercase tracking-[0.18em] text-rops-ink-2">
          {label}
          {required && <span className="text-rops-ember ml-0.5">*</span>}
        </span>
        {help && (
          <span className="font-body text-[10px] text-rops-taupe italic">
            {help}
          </span>
        )}
      </div>
      {children}
      {error && (
        <div className="flex items-center gap-1 mt-1 font-body text-[10px] text-rops-ember">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </label>
  );
}

const inputBase =
  "w-full bg-transparent border-b border-[1.5px] border-rops-line py-2.5 px-0 font-body text-[15px] text-rops-ink placeholder:text-rops-taupe/60 focus:outline-none focus:border-rops-ember transition-colors";

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={`${inputBase} ${props.className ?? ""}`}
    />
  );
}

function TextAreaInput(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 3}
      className={
        "w-full bg-transparent border border-rops-line rounded-sm py-3 px-3 font-body text-[15px] text-rops-ink placeholder:text-rops-taupe/60 focus:outline-none focus:border-rops-ember transition-colors resize-none " +
        (props.className ?? "")
      }
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`${inputBase} appearance-none bg-rops-cream cursor-pointer`}
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function SectionHeader({
  number,
  title,
  sub,
}: {
  number: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-end gap-4 mb-6 pb-3 border-b border-rops-line">
      <span className="font-display italic text-rops-ember text-3xl leading-none number-tag">
        {number}
      </span>
      <div className="flex-1">
        <h3 className="font-display text-rops-ink text-xl tracking-tight">
          {title}
        </h3>
        {sub && (
          <p className="font-body text-xs text-rops-taupe mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

