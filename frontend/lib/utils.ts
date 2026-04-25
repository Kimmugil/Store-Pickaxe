import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function ratingColor(rating: number | null): string {
  if (rating === null) return "text-neutral-400";
  if (rating >= 4.0) return "text-positive";
  if (rating >= 3.0) return "text-warning";
  return "text-negative";
}

export function ratingBg(rating: number | null): string {
  if (rating === null) return "bg-neutral-100";
  if (rating >= 4.0) return "bg-green-50";
  if (rating >= 3.0) return "bg-yellow-50";
  return "bg-red-50";
}

export function trendArrow(
  snapshots: { date: string; google_rating?: number | null; apple_rating?: number | null }[],
  platform: "google" | "apple"
): "up" | "down" | "neutral" {
  const key = platform === "google" ? "google_rating" : "apple_rating";
  const sorted = [...snapshots].sort((a, b) => (a.date > b.date ? 1 : -1));
  const recent = sorted.slice(-7);
  const older = sorted.slice(-37, -7);

  const avg = (arr: typeof sorted) => {
    const vals = arr.map((s) => Number((s as Record<string, unknown>)[key])).filter(Boolean);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const r = avg(recent);
  const o = avg(older);
  if (r === null || o === null) return "neutral";
  if (r - o > 0.15) return "up";
  if (o - r > 0.15) return "down";
  return "neutral";
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function formatRating(rating: number | null): string {
  if (rating === null || isNaN(rating)) return "—";
  return rating.toFixed(1);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function sentimentLabel(score: number | null, texts: Record<string, string>): string {
  if (score === null) return texts["common.unknown"] || "—";
  if (score >= 75) return texts["sentiment.positive"] || "긍정적";
  if (score >= 50) return texts["sentiment.neutral"] || "보통";
  return texts["sentiment.negative"] || "부정적";
}

export function eventTypeLabel(type: string, texts: Record<string, string>): string {
  return texts[`event.${type}`] || type;
}
