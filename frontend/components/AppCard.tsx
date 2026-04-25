import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AppMeta, Snapshot, Texts } from "@/lib/types";
import { ratingColor, trendArrow, formatRating, formatDate } from "@/lib/utils";
import { t } from "./TextsProvider";

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
    <Link href={`/${app.app_key}`} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* 헤더 */}
      <div className="flex items-start gap-3">
        {app.icon_url ? (
          <Image
            src={app.icon_url}
            alt={app.app_name}
            width={48}
            height={48}
            className="rounded-xl flex-shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{app.app_name}</p>
          <p className="text-xs text-gray-400 truncate">{app.developer}</p>
        </div>
        {hasAnalysis && (
          <span className="badge bg-indigo-50 text-indigo-600 ml-auto flex-shrink-0">
            AI
          </span>
        )}
      </div>

      {/* 평점 */}
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
            color="#555555"
            texts={texts}
          />
        )}
      </div>

      {/* 하단 */}
      <div className="text-xs text-gray-400 pt-1 border-t border-gray-50">
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
    trend === "up" ? "text-positive" : trend === "down" ? "text-negative" : "text-neutral-400";

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2">
      <span className="text-xs font-medium" style={{ color }}>
        {label}
      </span>
      <span className={`text-sm font-bold ${ratingColor(rating)}`}>
        ★ {formatRating(rating)}
      </span>
      <TrendIcon size={12} className={`ml-auto ${trendColor}`} />
    </div>
  );
}
