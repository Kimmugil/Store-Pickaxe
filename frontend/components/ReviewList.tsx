"use client";
import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import type { Review, Texts } from "@/lib/types";
import { useTexts } from "./TextsProvider";
import { ratingColor, formatDate } from "@/lib/utils";

interface Props {
  googleReviews: Review[];
  appleReviews: Review[];
}

export default function ReviewList({ googleReviews, appleReviews }: Props) {
  const texts = useTexts();
  const [platform, setPlatform] = useState<"google" | "apple">("google");

  const reviews = platform === "google" ? googleReviews : appleReviews;

  return (
    <div className="space-y-4">
      {/* 플랫폼 토글 */}
      <div className="flex gap-2">
        <button
          onClick={() => setPlatform("google")}
          className={platform === "google" ? "tab-active" : "tab-inactive"}
        >
          {texts["common.platform.google"] || "Google Play"} ({googleReviews.length})
        </button>
        <button
          onClick={() => setPlatform("apple")}
          className={platform === "apple" ? "tab-active" : "tab-inactive"}
        >
          {texts["common.platform.apple"] || "App Store"} ({appleReviews.length})
        </button>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          {texts["detail.reviews.no_reviews"] || "수집된 리뷰가 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.review_id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {r.title && <p className="text-sm font-medium text-gray-800">{r.title}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <Stars rating={r.rating} />
                    <span className="text-xs text-gray-400">{formatDate(r.reviewed_at)}</span>
                    {r.app_version && (
                      <span className="text-xs font-mono text-gray-300">v{r.app_version}</span>
                    )}
                  </div>
                </div>
                {r.thumbs_up != null && r.thumbs_up > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <ThumbsUp size={11} /> {r.thumbs_up}
                  </span>
                )}
              </div>
              {r.content && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-4">
                  {r.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={`text-sm font-bold ${ratingColor(rating)}`}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}
