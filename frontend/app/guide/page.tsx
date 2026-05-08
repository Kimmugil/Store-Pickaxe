export const revalidate = 3600;

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="font-black text-3xl" style={{ color: "#1A1A1A", letterSpacing: "-0.03em" }}>
          분석 가이드
        </h1>
        <p className="text-sm mt-1 font-medium" style={{ color: "#9CA3AF" }}>
          데이터 수집·분석 기준과 흐름을 설명합니다.
        </p>
      </div>

      <Section title="수집 흐름">
        <p>앱 상세 페이지에서 수동으로 수집을 트리거합니다. 두 가지 모드가 있습니다.</p>
        <ul className="space-y-2 mt-3">
          <Li><strong>전체 수집 (onboarding)</strong> — 최초 등록 시 또는 전체 재수집 시 사용. 최대 50페이지(약 2,500개) 수집.</Li>
          <Li><strong>신규 수집 (update)</strong> — 마지막 수집 이후 추가된 리뷰만 수집. 최대 10페이지.</Li>
        </ul>
        <p className="mt-3">수집 완료 시 <strong>분석 대기</strong> 상태로 전환됩니다.</p>
      </Section>

      <Section title="AI 분석 승인">
        <p>수집 완료 후 자동으로 분석이 실행되지 않습니다. 관리자 패널(<code>/admin</code>)에서 수동으로 승인해야 분석이 시작됩니다.</p>
        <p className="mt-2">분석이 완료되면 리포트 목록에 새 항목이 추가됩니다.</p>
      </Section>

      <Section title="리뷰 샘플링">
        <p>Gemini 분석에 사용하는 리뷰는 전체가 아닌 대표 샘플입니다.</p>
        <ul className="space-y-2 mt-3">
          <Li><strong>40%</strong> — 저평점 리뷰 (1~2★), thumbs_up 상위 우선</Li>
          <Li><strong>40%</strong> — 고평점 리뷰 (4~5★), thumbs_up 상위 우선</Li>
          <Li><strong>20%</strong> — 중간 평점 리뷰 (3★)</Li>
        </ul>
        <p className="mt-3">20자 미만 리뷰는 제외됩니다. 기본 샘플 수: 구글 150개, 애플 150개.</p>
      </Section>

      <Section title="분석 출력 항목">
        <ul className="space-y-1.5 mt-2">
          <Li>종합 한줄 요약</Li>
          <Li>주요 불만 (3개)</Li>
          <Li>주요 칭찬 (3개)</Li>
          <Li>긍정도 점수 0~100 (구글/애플 각각)</Li>
          <Li>주요 키워드 5개 (구글/애플 각각)</Li>
          <Li>플랫폼 간 반응 차이</Li>
        </ul>
      </Section>

      <Section title="리포트 보기">
        <p>각 분석은 독립적인 스냅샷으로 저장됩니다. 앱 상세 페이지에서 날짜별 리포트를 선택해 볼 수 있으며, 탭으로 구성됩니다.</p>
        <ul className="space-y-2 mt-3">
          <Li><strong>종합 요약</strong> — 긍정도 바, 불만·칭찬 목록</Li>
          <Li><strong>플랫폼 비교</strong> — Google vs Apple 나란히</Li>
          <Li><strong>리뷰 목록</strong> — 플랫폼 전환 + 별점 필터</Li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 space-y-3">
      <h2 className="font-black text-base" style={{ color: "#1A1A1A" }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: "#4A4A4A" }}>
        {children}
      </div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="flex-shrink-0 font-black" style={{ color: "#FFD600" }}>—</span>
      <span>{children}</span>
    </li>
  );
}
