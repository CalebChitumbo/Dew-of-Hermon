"use client";

import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResumeDraftDialogProps {
  open: boolean;
  savedAt: string | null;
  onResume: () => void;
  onStartFresh: () => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "earlier";
  try {
    return format(parseISO(iso), "EEE, d MMM yyyy 'at' HH:mm");
  } catch {
    return "earlier";
  }
}

export function ResumeDraftDialog({
  open,
  savedAt,
  onResume,
  onStartFresh,
}: ResumeDraftDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="[&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Pick up where you left off?</DialogTitle>
          <DialogDescription>
            We found an unfinished cycle saved on this browser
            {savedAt ? ` from ${formatRelative(savedAt)}` : ""}. Resume it, or
            start a fresh cycle (the saved one will be discarded).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onStartFresh}>
            Start fresh
          </Button>
          <Button onClick={onResume}>Resume draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
