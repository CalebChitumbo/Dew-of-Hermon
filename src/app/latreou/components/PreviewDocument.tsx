"use client";

import { format, parseISO } from "date-fns";
import type { LatreouCycle, Song } from "../lib/types";

interface PreviewDocumentProps {
  cycle: LatreouCycle;
}

function formatLong(iso: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "EEEE, d MMMM yyyy");
  } catch {
    return iso;
  }
}

function formatShort(iso: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "EEE, d MMM yyyy");
  } catch {
    return iso;
  }
}

function SongList({ songs }: { songs: Song[] }) {
  if (songs.length === 0) {
    return (
      <p className="text-sm italic text-clay-500">No songs added.</p>
    );
  }
  return (
    <ol className="space-y-2">
      {songs.map((s, i) => (
        <li key={s.id} className="flex flex-col gap-0.5 text-sm">
          <span className="font-semibold text-clay-700">
            {i + 1}. {s.title || "Untitled"}
          </span>
          <span className="text-clay-500">
            Led by {s.leader || "—"}
            {s.youtubeLink ? (
              <>
                {" · "}
                <a
                  href={s.youtubeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline"
                >
                  YouTube
                </a>
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-2xl uppercase tracking-wide text-clay-700">
        {children}
      </h2>
      <div className="mt-1 h-0.5 w-16 bg-gold" />
    </div>
  );
}

export function PreviewDocument({ cycle }: PreviewDocumentProps) {
  return (
    <article className="space-y-10 rounded-lg border border-clay-200 bg-white p-8 text-clay-700 shadow-sm">
      <header className="border-b border-clay-100 pb-6">
        <p className="font-display text-4xl text-clay-700">LATREOU</p>
        <p className="mt-1 text-sm italic text-clay-500">Worship Cycle Plan</p>
        <h1 className="mt-6 font-display text-2xl text-clay-700">
          {cycle.cycleName || "Untitled cycle"}
        </h1>
        <p className="mt-2 text-sm text-clay-500">
          Prepared by {cycle.preparedBy || "—"}
        </p>
      </header>

      <section>
        <SectionHeading>First Sunday</SectionHeading>
        <p className="mb-4 text-sm italic text-clay-500">
          {formatLong(cycle.firstSunday.date)}
        </p>
        <h3 className="text-base font-semibold text-clay-700">Praise</h3>
        <div className="mt-2">
          <SongList songs={cycle.firstSunday.praise} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-clay-700">Worship</h3>
        <div className="mt-2">
          <SongList songs={cycle.firstSunday.worship} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-clay-700">
          Special Song
        </h3>
        <p className="mt-1 text-sm">
          {cycle.firstSunday.specialItem.title ||
          cycle.firstSunday.specialItem.responsible ? (
            <>
              {cycle.firstSunday.specialItem.title || "—"}
              {" — led by "}
              {cycle.firstSunday.specialItem.responsible || "—"}
              {cycle.firstSunday.specialItem.link ? (
                <>
                  {" · "}
                  <a
                    href={cycle.firstSunday.specialItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline"
                  >
                    Listen
                  </a>
                </>
              ) : null}
            </>
          ) : (
            <span className="italic text-clay-500">None.</span>
          )}
        </p>
      </section>

      <section>
        <SectionHeading>Second Sunday</SectionHeading>
        <p className="mb-4 text-sm italic text-clay-500">
          {formatLong(cycle.secondSunday.date)}
        </p>
        <h3 className="text-base font-semibold text-clay-700">Praise</h3>
        <div className="mt-2">
          <SongList songs={cycle.secondSunday.praise} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-clay-700">Worship</h3>
        <div className="mt-2">
          <SongList songs={cycle.secondSunday.worship} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-clay-700">
          Special Song
        </h3>
        <p className="mt-1 text-sm">
          {cycle.secondSunday.specialItem.title ||
          cycle.secondSunday.specialItem.responsible ? (
            <>
              {cycle.secondSunday.specialItem.title || "—"}
              {" — led by "}
              {cycle.secondSunday.specialItem.responsible || "—"}
              {cycle.secondSunday.specialItem.link ? (
                <>
                  {" · "}
                  <a
                    href={cycle.secondSunday.specialItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline"
                  >
                    Listen
                  </a>
                </>
              ) : null}
            </>
          ) : (
            <span className="italic text-clay-500">None.</span>
          )}
        </p>
      </section>

      <section>
        <SectionHeading>Uniforms</SectionHeading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-base font-semibold text-clay-700">
              First Sunday
            </h3>
            <p className="mt-1 text-sm">
              <span className="font-medium">Gents:</span>{" "}
              {cycle.uniforms.firstSundayGents || "—"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Ladies:</span>{" "}
              {cycle.uniforms.firstSundayLadies || "—"}
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-clay-700">
              Second Sunday
            </h3>
            <p className="mt-1 text-sm">
              <span className="font-medium">Gents:</span>{" "}
              {cycle.uniforms.secondSundayGents || "—"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Ladies:</span>{" "}
              {cycle.uniforms.secondSundayLadies || "—"}
            </p>
          </div>
        </div>
        {cycle.uniforms.notes ? (
          <div className="mt-4">
            <h3 className="text-base font-semibold text-clay-700">Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {cycle.uniforms.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeading>Rehearsal schedule</SectionHeading>
        {cycle.rehearsals.length === 0 ? (
          <p className="text-sm italic text-clay-500">
            No rehearsals scheduled.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-clay-200">
            <table className="w-full text-sm">
              <thead className="bg-clay-700 text-cream">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Time</th>
                  <th className="px-3 py-2 text-left font-semibold">Location</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Coordinator
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Focus</th>
                </tr>
              </thead>
              <tbody>
                {cycle.rehearsals.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={idx % 2 === 0 ? "bg-cream" : "bg-white"}
                  >
                    <td className="px-3 py-2">{formatShort(r.date)}</td>
                    <td className="px-3 py-2">{r.time || "—"}</td>
                    <td className="px-3 py-2">{r.location || "—"}</td>
                    <td className="px-3 py-2">{r.coordinator || "—"}</td>
                    <td className="px-3 py-2">{r.focus || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionHeading>Anchor scripture</SectionHeading>
        <p className="text-base font-semibold text-clay-700">
          {cycle.scripture.reference || "—"}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm italic text-clay-700">
          {cycle.scripture.text || "—"}
        </p>
      </section>

      <section>
        <SectionHeading>Prayer direction</SectionHeading>
        <p className="whitespace-pre-wrap text-sm">
          {cycle.prayerDirection || "—"}
        </p>
      </section>
    </article>
  );
}
