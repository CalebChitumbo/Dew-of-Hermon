"use client";

import { useEffect, useRef, useState } from "react";
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

// ─── CONFIG ─────────────────────────────────────────────────────────
const camp = CAMPS[0];
const CAMP_FEE_ZMW = camp.fee;
const CAMP_DATES = "20 — 24 August 2026";
const VENUE = "ROPs Campsite (TBD)";
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
interface FormState {
  camperName: string;
  camperDob: string;
  camperGender: "" | "Male" | "Female";
  tshirtSize: "" | "XS" | "S" | "M" | "L" | "XL" | "XXL";
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
  camperName: "",
  camperDob: "",
  camperGender: "",
  tshirtSize: "",
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
}

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
      <FontStyles />

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
        <button
          onClick={onAdminClick}
          className="font-body text-[11px] uppercase tracking-[0.18em] text-rops-taupe hover:text-rops-ink flex items-center gap-1.5 transition-colors"
        >
          <Lock size={12} /> Admin
        </button>
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
              Five days. One mountain to climb together. ROPs X is where our
              young people walk from boyhood and girlhood toward the calling on
              their lives — built around worship, wisdom, and friendships that
              last.
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
            value="13 — 19 years"
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
              <span>worship</span>
              <Sparkles size={14} className="text-rops-ember" />
              <span>wisdom</span>
              <Sparkles size={14} className="text-rops-ember" />
              <span>wilderness</span>
              <Sparkles size={14} className="text-rops-ember" />
              <span>witness</span>
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
              Five days,
              <span className="italic"> one rhythm.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 min-w-0">
            <p className="font-body text-rops-ink-2 text-base leading-relaxed">
              These are real moments from ROPs IX — the camp your child is
              about to step into. Mornings on the mountain, brotherhood over
              nshima, hands open in worship, elders speaking truth. This is
              what passage looks like.
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
    if (!form.camperName.trim()) err.camperName = "Camper name is required";
    if (!form.camperDob) err.camperDob = "Date of birth is required";
    if (!form.camperGender) err.camperGender = "Please select";
    if (!form.parentName.trim())
      err.parentName = "Parent/guardian name required";
    if (!form.parentPhone.trim()) err.parentPhone = "Primary phone required";
    if (form.parentEmail && !/^\S+@\S+\.\S+$/.test(form.parentEmail))
      err.parentEmail = "Enter a valid email";
    if (!form.emergencyName.trim())
      err.emergencyName = "Emergency contact required";
    if (!form.emergencyPhone.trim())
      err.emergencyPhone = "Emergency phone required";
    if (!form.dropoffLocation)
      err.dropoffLocation = "Choose a drop-off location";
    if (!form.consent) err.consent = "Parent/guardian consent is required";
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
          firstName,
          lastName,
          dateOfBirth: form.camperDob,
          gender: form.camperGender === "Male" ? "MALE" : "FEMALE",
          phone: form.parentPhone,
          email: form.parentEmail || undefined,
          tshirtSize: form.tshirtSize || undefined,
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
            <span className="italic"> by the fire.</span>
          </h2>
          <p className="font-body text-rops-ink-2 mt-4 max-w-xl mx-auto">
            Fill in the details below. After submission you&rsquo;ll receive
            payment instructions — send proof of payment and we&rsquo;ll mark
            your slot as confirmed.
          </p>
        </div>

        {/* SECTION 1 — CAMPER */}
        <div className="mb-12">
          <SectionHeader
            number="01"
            title="The Camper"
            sub="Tell us about the young person attending."
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div data-field="camperName" className="md:col-span-2">
              <Field label="Full Name" required error={errors.camperName}>
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
            <Field label="T-Shirt Size" help="for the camp pack">
              <SelectField
                value={form.tshirtSize}
                onChange={set("tshirtSize")}
                options={["XS", "S", "M", "L", "XL", "XXL"]}
              />
            </Field>
          </div>
        </div>

        {/* SECTION 2 — PARENT */}
        <div className="mb-12">
          <SectionHeader
            number="02"
            title="Parent / Guardian"
            sub="Who is registering this camper?"
          />
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div data-field="parentName">
              <Field label="Full Name" required error={errors.parentName}>
                <TextInput
                  value={form.parentName}
                  onChange={set("parentName")}
                />
              </Field>
            </div>
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
            <div data-field="parentPhone">
              <Field label="Primary Phone" required error={errors.parentPhone}>
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
                  placeholder="parent@example.com"
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
            sub="Someone we can reach if the parent/guardian is unavailable."
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
            sub="Help our team care well for the camper. Leave blank if none."
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
            title="Drop-off Location"
            sub="Where would you like to drop your camper for transport to camp?"
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
              title="At the Church"
              meta={CHURCH_ADDRESS}
              detail="The team will travel together to the campsite as a group."
            />
            <DropoffOption
              selected={form.dropoffLocation === "campsite"}
              onClick={() =>
                setForm((f) => ({ ...f, dropoffLocation: "campsite" }))
              }
              icon={<Tent size={32} strokeWidth={1.4} />}
              title="At the Camp Site"
              meta={VENUE}
              detail="You will drive your camper directly to the camp venue."
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
                As parent/guardian I give my consent for the camper to attend
                ROPs X 2026, and I confirm that the information provided is
                true and complete. I understand that{" "}
                <span className="font-medium">
                  registration is confirmed only upon receipt of payment
                </span>
                .
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
            Once submitted, you&rsquo;ll see payment details. Send proof to the
            camp coordinator — the system will update your camper&rsquo;s
            status to{" "}
            <span className="text-rops-forest font-semibold">paid</span>.
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
  const ref = reg.id.toUpperCase().slice(-8);
  const firstName = reg.camperName.split(/\s+/)[0] || reg.camperName;

  return (
    <section className="bg-rops-cream py-24 px-6 md:px-10 rops-grain min-h-[80vh] flex items-center">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rops-forest mb-8 rise rise-1">
          <Check size={36} className="text-rops-cream" strokeWidth={2.5} />
        </div>
        <div className="rise rise-2 font-body text-[11px] uppercase tracking-[0.22em] text-rops-ember mb-3">
          Registration Received
        </div>
        <h2 className="rise rise-2 font-display text-rops-ink text-5xl tracking-tight mb-4">
          See you<span className="italic"> by the fire,</span>
          <br />
          {firstName}.
        </h2>
        <p className="rise rise-3 font-body text-rops-ink-2 mt-6 text-lg leading-relaxed">
          Your slot has been reserved. Please complete payment within{" "}
          <span className="font-semibold">7 days</span> to confirm.
        </p>

        <div className="rise rise-4 mt-10 text-left bg-rops-cream-2 border border-rops-line rounded-sm p-6">
          <div className="font-body text-[11px] uppercase tracking-[0.2em] text-rops-ember mb-3">
            Payment Instructions
          </div>
          <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 font-body text-sm">
            <Row k="Amount" v={`ZMW ${CAMP_FEE_ZMW.toLocaleString()}`} />
            <Row k="Reference" v={ref} />
            <Row k="Method" v="Mobile Money / Bank Transfer" />
            <Row k="Send proof to" v="Camp Coordinator" />
          </div>
          <div className="mt-5 pt-4 border-t border-rops-line font-body text-xs text-rops-taupe leading-relaxed">
            Use the reference above when sending proof of payment so we can
            match your transaction to {reg.camperName}&rsquo;s registration.
          </div>
        </div>

        <button
          onClick={onAnother}
          className="rise rise-5 mt-10 inline-flex items-center gap-2 font-body text-[13px] uppercase tracking-[0.18em] text-rops-ink hover:text-rops-ember transition-colors"
        >
          <ArrowLeft size={14} /> Register another camper
        </button>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="text-rops-taupe">{k}</div>
      <div className="text-rops-ink font-medium number-tag">{v}</div>
    </>
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
            See you by the fire.
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
              Reach out to the camp coordinator at the church.
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

// ─── SHARED VISUAL TOKENS ──────────────────────────────────────────
function FontStyles() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Manrope:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Manrope', system-ui, sans-serif; }
        .number-tag { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "ss01" 1; }

        .bg-rops-cream { background-color: #F4EEE3; }
        .bg-rops-cream-2 { background-color: #EDE5D5; }
        .bg-rops-ink { background-color: #16110D; }
        .bg-rops-ink-2 { background-color: #2A211A; }
        .bg-rops-ember { background-color: #D14A1F; }
        .bg-rops-forest { background-color: #1F3A2E; }

        .text-rops-cream { color: #F4EEE3; }
        .text-rops-cream\\/70 { color: rgba(244, 238, 227, 0.7); }
        .text-rops-ink { color: #16110D; }
        .text-rops-ink-2 { color: #2A211A; }
        .text-rops-ink\\/70 { color: rgba(22, 17, 13, 0.7); }
        .text-rops-ember { color: #D14A1F; }
        .text-rops-forest { color: #1F3A2E; }
        .text-rops-taupe { color: #968779; }

        .border-rops-line { border-color: #DCD2BE; }
        .border-rops-ink { border-color: #16110D; }
        .border-rops-ember { border-color: #D14A1F; }
        .border-rops-taupe { border-color: rgba(150, 135, 121, 1); }
        .border-rops-taupe\\/20 { border-color: rgba(150, 135, 121, 0.2); }
        .border-rops-taupe\\/40 { border-color: rgba(150, 135, 121, 0.4); }

        .hover\\:bg-rops-ember:hover { background-color: #D14A1F; }
        .hover\\:bg-rops-ember-2:hover { background-color: #B23E18; }
        .hover\\:border-rops-ink:hover { border-color: #16110D; }
        .hover\\:border-rops-cream:hover { border-color: #F4EEE3; }
        .hover\\:text-rops-cream:hover { color: #F4EEE3; }
        .hover\\:text-rops-ink:hover { color: #16110D; }
        .hover\\:text-rops-ember:hover { color: #D14A1F; }

        .group:hover .group-hover\\:border-rops-ink { border-color: #16110D; }

        .focus\\:border-rops-ember:focus { border-color: #D14A1F; }
        .focus\\:outline-none:focus { outline: none; }

        .placeholder\\:text-rops-taupe\\/60::placeholder { color: rgba(150, 135, 121, 0.6); }

        .bg-rops-cream\\/5 { background-color: rgba(244, 238, 227, 0.05); }
        .bg-rops-ember\\/5 { background-color: rgba(209, 74, 31, 0.05); }
        .border-rops-ember\\/30 { border-color: rgba(209, 74, 31, 0.3); }

        .text-rops-h1 {
          font-size: 2.75rem;
          line-height: 0.95;
          letter-spacing: -0.02em;
        }
        @media (min-width: 480px) { .text-rops-h1 { font-size: 3.5rem; } }
        @media (min-width: 640px) { .text-rops-h1 { font-size: 4.5rem; } }
        @media (min-width: 768px) { .text-rops-h1 { font-size: 5.5rem; line-height: 0.92; } }
        @media (min-width: 1024px) { .text-rops-h1 { font-size: 7rem; } }

        .ember-glow { box-shadow: 0 6px 30px -10px rgba(209,74,31,0.55); }
        .rops-grain {
          background-image: radial-gradient(rgba(22,17,13,0.045) 1px, transparent 1px);
          background-size: 3px 3px;
        }

        @keyframes risefade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise { animation: risefade 700ms cubic-bezier(.2,.7,.2,1) both; }
        .rise-1 { animation-delay: 60ms; }
        .rise-2 { animation-delay: 140ms; }
        .rise-3 { animation-delay: 220ms; }
        .rise-4 { animation-delay: 300ms; }
        .rise-5 { animation-delay: 380ms; }

        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          50% { opacity: 0.85; transform: scaleY(1.05); }
        }
        .flame-flicker {
          animation: flicker 2.4s ease-in-out infinite;
          transform-origin: center bottom;
        }

        .marquee-mask {
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        .grad-ink-30-up {
          background-image: linear-gradient(to top, rgba(22, 17, 13, 0.3) 0%, transparent 60%);
        }
        .grad-footer-up {
          background-image: linear-gradient(to top, #16110D 0%, rgba(22, 17, 13, 0.4) 60%, transparent 100%);
        }
      `}</style>
    </>
  );
}
