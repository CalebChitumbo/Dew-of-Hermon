"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, QrCode } from "lucide-react";
import QRCode from "qrcode";

interface CheckInPassCardProps {
  checkInCode: string;
  camperName: string;
  checkedIn: boolean;
}

function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

/**
 * The camper's QR check-in pass — the same code emailed at registration,
 * rendered in-app so it's never lost. Admins scan it at the camp gate.
 */
export function CheckInPassCard({
  checkInCode,
  camperName,
  checkedIn,
}: CheckInPassCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkInUrl = `${window.location.origin}/manage/rops-camp/check-in?code=${checkInCode}`;
    QRCode.toDataURL(checkInUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#16110D", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR render failed — the printed code below still works
      });
    return () => {
      cancelled = true;
    };
  }, [checkInCode]);

  return (
    <div className="bg-rops-ink rounded-sm p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <QrCode size={14} className="text-rops-ember" />
        <span className="font-body text-[10px] uppercase tracking-[0.2em] text-rops-ember">
          Check-in pass · show at the camp gate
        </span>
      </div>

      {checkedIn ? (
        <div className="inline-flex items-center gap-2 bg-rops-forest text-rops-cream rounded-full px-4 py-1.5 font-body text-[11px] uppercase tracking-[0.18em] mb-4">
          <CheckCircle2 size={13} /> Checked in to camp
        </div>
      ) : null}

      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`Check-in QR code for ${camperName}`}
          className="mx-auto w-44 h-44 rounded-sm bg-white p-2"
        />
      ) : (
        <div className="mx-auto w-44 h-44 rounded-sm bg-rops-ink-2 animate-pulse" />
      )}

      <div className="mt-4 font-body text-rops-cream tracking-[0.15em] text-base number-tag">
        {formatCode(checkInCode)}
      </div>
      <p className="mt-2 font-body text-[11px] text-rops-taupe leading-relaxed">
        Our team scans this when {camperName} arrives.
        <br />
        Can&rsquo;t scan? Give them the code above instead.
      </p>
    </div>
  );
}
