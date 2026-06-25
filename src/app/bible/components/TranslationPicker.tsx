"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchTranslations, type TranslationOption } from "@/lib/bible/api";

interface TranslationPickerProps {
  value: string;
  onChange: (id: string) => void;
}

/** Languages listed first in the picker, in this order. The rest follow A→Z. */
const PINNED_LANGUAGES = ["English"];

/**
 * Version switcher. Loads the provider's full translation catalogue once, then
 * lets the user search and pick from every available version, grouped by
 * language. Falls back to the built-in list if the catalogue can't load.
 */
export function TranslationPicker({ value, onChange }: TranslationPickerProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TranslationOption[]>([]);
  const [term, setTerm] = useState("");

  useEffect(() => {
    let active = true;
    fetchTranslations().then((opts) => {
      if (active) setOptions(opts);
    });
    return () => {
      active = false;
    };
  }, []);

  const current = options.find((o) => o.id === value);

  // Group filtered options by language, with pinned languages first.
  const groups = useMemo(() => {
    const q = term.trim().toLowerCase();
    const filtered = q
      ? options.filter(
          (o) =>
            o.id.toLowerCase().includes(q) ||
            o.name.toLowerCase().includes(q) ||
            o.language.toLowerCase().includes(q)
        )
      : options;

    const byLang = new Map<string, TranslationOption[]>();
    for (const o of filtered) {
      const list = byLang.get(o.language) ?? [];
      list.push(o);
      byLang.set(o.language, list);
    }

    const languages = Array.from(byLang.keys()).sort((a, b) => {
      const ia = PINNED_LANGUAGES.indexOf(a);
      const ib = PINNED_LANGUAGES.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
      }
      return a.localeCompare(b);
    });

    return languages.map((language) => ({
      language,
      items: (byLang.get(language) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [options, term]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <span className="font-semibold">{value}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a version</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search version or language…"
            className="pl-9"
          />
        </div>

        <div className="-mx-2 flex-1 overflow-y-auto px-2">
          {current && !term && (
            <p className="px-1 pb-2 pt-1 text-xs text-clay-400">
              Currently reading <span className="font-medium text-clay-600">{current.name}</span>
            </p>
          )}
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-clay-400">No versions match “{term}”.</p>
          ) : (
            groups.map((group) => (
              <div key={group.language} className="mb-3">
                <p className="sticky top-0 bg-white py-1 text-xs font-semibold uppercase tracking-wide text-clay-400">
                  {group.language}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((o) => (
                    <button
                      key={`${o.language}-${o.id}`}
                      onClick={() => {
                        onChange(o.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        o.id === value
                          ? "bg-gold/20 text-gold-dark"
                          : "text-clay-600 hover:bg-clay-50"
                      )}
                    >
                      <span className="w-14 shrink-0 font-semibold">{o.id}</span>
                      <span className="truncate text-clay-500">{o.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
