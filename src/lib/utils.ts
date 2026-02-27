import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return format(date, "EEEE, d MMMM yyyy");
}

export function formatDateShort(date: Date): string {
  return format(date, "d MMM yyyy");
}

export function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

export function getRelativeDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function replacePlaceholders(
  template: string,
  data: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export function firestoreTimestampToDate(timestamp: { seconds: number; nanoseconds: number } | Date | null): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if ("seconds" in timestamp) {
    return new Date(timestamp.seconds * 1000);
  }
  return null;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
