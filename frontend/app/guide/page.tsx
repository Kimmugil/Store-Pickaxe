import { getTexts } from "@/lib/sheets";
import { t } from "@/components/TextsProvider";

export const revalidate = 3600;

export default async function GuidePage() {
  const texts = await getTexts();

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t(texts, "guide.title", "분석 가이드")}</h1>
        <p className="text-sm text-gray-400 mt-1">{t(texts, "guide.desc", "데이터 수집·분석 기준과 공식을 설명합니다.")}</p>
      </div>

      {/* 수집 주기 */}
      <Section title={t(texts, "guide.section.collection", "데이터 수집")}>
        <Subsection title={t(texts, "guide.collection.snapshot.title", "평점 스냅샷")}>
          <p>{t(texts, "guide.collection.snapshot.desc", "매일 새벽 3시(KST) 구글·애플 양쪽 현재 평점과 앱 버전을 저장합니다. 버전이 바뀌면 타임라인 이벤트가 자동 생성됩니다.")}</p>
        </Subsection>
        <Subsection title={t(texts, "guide.collection.frequency.title", "리뷰 수집 빈도")}>
          <p className="mb-2">{t(texts, "guide.collection.frequency.desc", "앱의 리뷰 발생 속도(주간 리뷰 수)에 따라 자동 분류됩니다.")}</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">{t(texts, "guide.table.level", "등급")}</th>
                <th className="pb-2 pr-4">{t(texts, "guide.table.condition", "조건")}</th>
                <th className="pb-2">{t(texts, "guide.table.schedule", "수집 요일")}</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-green-600">High</td>
                <td className="py-2 pr-4">{t(texts, "guide.collection.frequency.high", "주 50개 이상")}</td>
                <td className="py-2">{t(texts, "guide.collection.frequency.high_days", "월·수·금 (주 3회)")}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-yellow-600">Medium</td>
                <td className="py-2 pr-4">{t(texts, "guide.collection.frequency.medium", "주 10~49개")}</td>
                <td className="py-2">{t(texts, "guide.collection.frequency.medium_days", "화·토 (주 2회)")}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-500">Low</td>
                <td className="py-2 pr-4">{t(texts, "guide.collection.frequency.low", "주 10개 미만")}</td>
                <td className="py-2">{t(texts, "guide.collection.frequency.low_days", "일요일 (주 1회)")}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">
            {t(texts, "guide.collection.apple_note", "애플 앱스토어는 최근 500개 리뷰만 제공됩니다. 수집 빈도가 높을수록 리뷰 누락 가능성이 줄어듭니다.")}
          </p>
        </Subsection>
      </Section>

      {/* 이벤트 감지 */}
      <Section title={t(texts, "guide.section.detection", "이벤트 자동 감지")}>
        <Subsection title={t(texts, "guide.detection.version.title", "버전 출시")}>
          <Formula>{t(texts, "guide.detection.version.formula", "스냅샷의 앱 버전이 이전 날짜와 달라지면 → version_release 이벤트 생성")}</Formula>
        </Subsection>

        <Subsection title={t(texts, "guide.detection.shift.title", "평점 급변 (sentiment_shift)")}>
          <Formula>{t(texts, "guide.detection.shift.formula", "7일 롤링 평균 평점 − 30일 기준선 평균 평점 = 변화폭\n변화폭 > 임계값 AND 기간 데이터 5일 이상 → 이벤트 생성")}</Formula>
          <p className="mb-2 text-sm">{t(texts, "guide.detection.shift.threshold_desc", "임계값은 앱의 리뷰 속도(등급)에 따라 달라집니다.")}</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">{t(texts, "guide.table.level", "등급")}</th>
                <th className="pb-2">{t(texts, "guide.table.threshold", "임계값")}</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-green-600">High</td>
                <td className="py-2">{t(texts, "guide.detection.shift.threshold.high", "±0.5점")}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium text-yellow-600">Medium</td>
                <td className="py-2">{t(texts, "guide.detection.shift.threshold.medium", "±0.7점")}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-500">Low</td>
                <td className="py-2">{t(texts, "guide.detection.shift.threshold.low", "±1.0점")}</td>
              </tr>
            </tbody>
          </table>
        </Subsection>

        <Subsection title={t(texts, "guide.detection.surge.title", "리뷰 급증 (review_surge)")}>
          <Formula>{t(texts, "guide.detection.surge.formula", "최근 7일 일평균 신규 리뷰 수 ÷ 30일 일평균 신규 리뷰 수 ≥ 3배 → 이벤트 생성")}</Formula>
          <p className="text-sm text-gray-500">{t(texts, "guide.detection.surge.note", "배수 기준(기본 3배)은 CONFIG 탭의 REVIEW_SURGE_MULTIPLIER로 조정 가능합니다.")}</p>
        </Subsection>
      </Section>

      {/* AI 분석 */}
      <Section title={t(texts, "guide.section.ai", "AI 분석")}>
        <Subsection title={t(texts, "guide.ai.trigger.title", "분석 발동 조건")}>
          <p className="text-sm mb-2">{t(texts, "guide.ai.trigger.desc", "관리자가 AI 분석을 승인한 앱에 한해 아래 조건 중 하나가 충족되면 자동으로 분석이 예약됩니다.")}</p>
          <ul className="space-y-1.5 text-sm">
            {[
              ["guide.ai.trigger.registration", "앱 최초 등록 후 리뷰 30개 이상 수집 시"],
              ["guide.ai.trigger.version", "버전 업데이트 감지 AND 해당 버전 리뷰 50개 이상"],
              ["guide.ai.trigger.shift", "평점 급변 이벤트 감지 시"],
              ["guide.ai.trigger.surge", "리뷰 급증 이벤트 감지 시"],
              ["guide.ai.trigger.admin", "관리자 패널에서 수동 트리거"],
            ].map(([key, fallback]) => (
              <li key={key} className="flex items-start gap-2">
                <span className="text-indigo-400 flex-shrink-0">•</span>
                {t(texts, key, fallback)}
              </li>
            ))}
          </ul>
        </Subsection>

        <Subsection title={t(texts, "guide.ai.sampling.title", "리뷰 샘플링 방법")}>
          <Formula>{t(texts, "guide.ai.sampling.formula", "최신 60% + 무작위 40% 혼합\n구글: 최대 100개 / 애플: 최대 50개 → 합계 최대 150개")}</Formula>
          <p className="text-sm text-gray-500">{t(texts, "guide.ai.sampling.note", "샘플 크기는 CONFIG 탭의 SAMPLE_GOOGLE_COUNT / SAMPLE_APPLE_COUNT로 조정 가능합니다.")}</p>
        </Subsection>

        <Subsection title={t(texts, "guide.ai.output.title", "분석 출력 항목")}>
          <ul className="space-y-1 text-sm text-gray-600">
            {[
              ["guide.ai.output.summary", "종합 요약 (한 문장)"],
              ["guide.ai.output.complaints", "주요 불만 3가지"],
              ["guide.ai.output.praises", "주요 칭찬 3가지"],
              ["guide.ai.output.sentiment", "감정 점수 0~100 (구글/애플 각각)"],
              ["guide.ai.output.keywords", "주요 키워드 5개 (구글/애플 각각)"],
              ["guide.ai.output.platform_diff", "플랫폼 반응 차이"],
            ].map(([key, fallback]) => (
              <li key={key} className="flex items-start gap-2">
                <span className="text-gray-300 flex-shrink-0">—</span>
                {t(texts, key, fallback)}
              </li>
            ))}
          </ul>
        </Subsection>
      </Section>

      {/* 스케줄 요약 */}
      <Section title={t(texts, "guide.section.schedule", "자동화 스케줄 요약")}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 pr-4">{t(texts, "guide.table.task", "작업")}</th>
              <th className="pb-2 pr-4">{t(texts, "guide.table.schedule", "주기")}</th>
              <th className="pb-2">{t(texts, "guide.table.trigger", "트리거")}</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {[
              ["guide.schedule.snapshot", "평점·버전 스냅샷", "매일 03:00 (KST)", "collect.yml"],
              ["guide.schedule.review_high", "리뷰 수집 (High)", "월·수·금", "collect.yml"],
              ["guide.schedule.review_medium", "리뷰 수집 (Medium)", "화·토", "collect.yml"],
              ["guide.schedule.review_low", "리뷰 수집 (Low)", "매주 일요일", "collect.yml"],
              ["guide.schedule.event_detection", "이벤트 감지", "수집 직후 자동", "collect.yml"],
              ["guide.schedule.analyze", "AI 분석", "수집 완료 후 자동 (조건 충족 시)", "analyze.yml"],
            ].map(([key, fallbackTask, fallbackSchedule, fallbackTrigger]) => (
              <tr key={key} className="border-b border-gray-50">
                <td className="py-2 pr-4">{t(texts, key, fallbackTask)}</td>
                <td className="py-2 pr-4 text-gray-500">{fallbackSchedule}</td>
                <td className="py-2 font-mono text-xs text-gray-400">{fallbackTrigger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="text-sm text-gray-600 space-y-1.5">{children}</div>
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-700 font-mono whitespace-pre-wrap overflow-x-auto">
      {children}
    </pre>
  );
}
