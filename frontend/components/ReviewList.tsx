"use client";
import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import type { Review } from "@/lib/types";
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
      {/* Platform toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPlatform("google")}
          className={platform === "google" ? "tab-active" : "tab-inactive"}
        >
          <span style={{ color: platform === "google" ? "#FFFFFF" : "#4285F4" }} className="font-black text-xs">G</span>
          {texts["common.platform.google"] || "Google Play"} ({googleReviews.length})
        </button>
        <button
          onClick={() => setPlatform("apple")}
          className={platform === "apple" ? "tab-active" : "tab-inactive"}
        >
          <span style={{ color: platform === "apple" ? "#FFFFFF" : "#1A1A1A" }} className="font-black text-xs">A</span>
          {texts["common.platform.apple"] || "App Store"} ({appleReviews.length})
        </button>
      </div>

      {reviews.length === 0 ? (
        <div
          className="flex items-center justify-center py-12 rounded-2xl"
          style={{ border: "2px dashed #1A1A1A", background: "#FAFAFA" }}
        >
          <p className="text-sm font-bold text-[#9CA3AF]">
            {texts["detail.reviews.no_reviews"] || "수집된 리뷰가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.review_id}
              className="rounded-2xl p-4"
              style={{ border: "2px solid #1A1A1A", background: "#FFFFFF" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {r.title && (
                    <p className="text-sm font-black text-[#1A1A1A]">{r.title}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Stars rating={r.rating} />
                    <span className="text-xs font-medium text-[#9CA3AF]">
                      {formatDate(r.reviewed_at)}
                    </span>
                    {r.app_version && (
                      <span
                        className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "#F0EFEC", border: "1px solid #E2E8F0", color: "#9CA3AF" }}
                      >
                        v{r.app_version}
                      </span>
                    )}
                  </div>
                </div>
                {r.thumbs_up != null && r.thumbs_up > 0 && (
                  <span
                    className="flex items-center gap-1 text-xs font-bold flex-shrink-0 px-2 py-1 rounded-full"
                    style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0", color: "#9CA3AF" }}
                  >
                    <ThumbsUp size={10} /> {r.thumbs_up}
                  </span>
                )}
              </div>
              {r.content && (
                <p className="text-sm text-[#4A4A4A] mt-2 leading-relaxed line-clamp-4">
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
    <span className={`text-sm font-black ${ratingColor(rating)}`}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}
