import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Minus, Sparkles, Clock } from "lucide-react";
import type { AppMeta, Snapshot, Texts } from "@/lib/types";
import { ratingColor, trendArrow, formatRating, formatDate, t } from "@/lib/utils";

interface Props {
  app: AppMeta;
  snapshots: Snapshot[];
  hasAnalysis: boolean;
  lastAnalysisDate?: string;
  texts: Texts;
}

export default function AppCard({ app, snapshots, hasAnalysis, lastAnalysisDate, texts }: Props) {
  const googleTrend = trendArrow(snapshots, "google");
  const appleTrend = trendArrow(snapshots, "apple");

  return (
    <Link
      href={`/${app.app_key}`}
      className="neo-card p-5 flex flex-col gap-4 block"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {app.icon_url ? (
          <Image
            src={app.icon_url}
            alt={app.app_name}
            width={52}
            height={52}
            className="rounded-2xl flex-shrink-0"
            style={{ border: "2px solid #1A1A1A" }}
            unoptimized
          />
        ) : (
          <div
            className="w-[52px] h-[52px] rounded-2xl flex-shrink-0 flex items-center justify-center text-xl"
            style={{ background: "#FFD600", border: "2px solid #1A1A1A" }}
          >
            🎮
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-black text-[#1A1A1A] truncate text-base leading-tight">
            {app.app_name}
          </p>
          <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{app.developer}</p>
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {app.status === "pending" && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#FFFDE7", color: "#B7960A", border: "1.5px solid #B7960A" }}
            >
              {t(texts, "admin.app.status.pending", "승인 대기")}
            </span>
          )}
          {hasAnalysis && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "#EEF2FF", color: "#4338CA", border: "1.5px solid #4338CA" }}
            >
              <Sparkles size={9} /> AI
            </span>
          )}
        </div>
      </div>

      {/* Ratings */}
      <div className="grid grid-cols-2 gap-2">
        {app.google_package && (
          <RatingBadge
            label={t(texts, "common.platform.google", "Google")}
            rating={app.google_rating}
            trend={googleTrend}
            color="#4285F4"
            texts={texts}
          />
        )}
        {app.apple_app_id && (
          <RatingBadge
            label={t(texts, "common.platform.apple", "Apple")}
            rating={app.apple_rating}
            trend={appleTrend}
            color="#1A1A1A"
            texts={texts}
          />
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-1.5 text-xs pt-3"
        style={{ borderTop: "1.5px solid #E2E8F0", color: "#9CA3AF" }}
      >
        <Clock size={10} />
        {hasAnalysis && lastAnalysisDate
          ? `${t(texts, "home.card.last_analysis", "최근 분석")} ${formatDate(lastAnalysisDate)}`
          : t(texts, "home.card.no_analysis", "분석 없음")}
      </div>
    </Link>
  );
}

function RatingBadge({
  label,
  rating,
  trend,
  color,
  texts,
}: {
  label: string;
  rating: number | null;
  trend: "up" | "down" | "neutral";
  color: string;
  texts: Texts;
}) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "#56D0A0" : trend === "down" ? "#FF6B6B" : "#9CA3AF";

  return (
    <div
      className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
      style={{ background: "#F0EFEC", border: "1.5px solid #E2E8F0" }}
    >
      <span className="text-xs font-bold" style={{ color }}>
        {label}
      </span>
      <span className={`text-sm font-black ${ratingColor(rating)}`}>
        ★ {formatRating(rating)}
      </span>
      <TrendIcon size={12} className="ml-auto" style={{ color: trendColor }} />
    </div>
  );
}
