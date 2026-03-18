/**
 * dataHandler.js
 * ─────────────────────────────────────────────────────────────────
 * Azure Function API 호출 유틸리티
 *
 * ▶ 개발(더미) 모드
 *   .env.development 에  REACT_APP_USE_DUMMY=true  설정
 *   → 실제 API 호출 없이 더미 데이터 반환
 *
 * ▶ 실제 동작 모드 (기본값)
 *   Azure Function URL 호출:
 *
 * Azure Function 호출 규약 (query string):
 *   ?action=dashboard    → 대시보드 통합 데이터
 *   ?action=contractInfo → 계약 정보
 *   ?action=siteInfo     → 현장 정보
 *   ?action=health       → 헬스체크
 * ─────────────────────────────────────────────────────────────────
 */

// ── 환경 설정 ──────────────────────────────────────────────────────
// TODO: Azure Function 연동 준비 완료 후 false 로 변경
const USE_DUMMY = true; // process.env.REACT_APP_USE_DUMMY === 'true';

const AZURE_FN_URL =
  process.env.REACT_APP_AZURE_FN_URL ||
  'https://';

// ── 더미 데이터 ────────────────────────────────────────────────────
const DUMMY_SITES = [
  {
    id_site: 1001,
    site_name: '수원 1공장',
    site_addr: '경기도 수원시 팔달구 매산로 1',
    hasActiveContract: true,
    contract: { expireDate: '2026-12-31T00:00:00' },
  },
  {
    id_site: 1002,
    site_name: '인천 ESS센터',
    site_addr: '인천광역시 남동구 논현동 609',
    hasActiveContract: true,
    contract: { expireDate: '2026-04-10T00:00:00' }, // 만료임박
  },
  {
    id_site: 1003,
    site_name: '대구 2공장',
    site_addr: '대구광역시 달서구 성서공단로 199',
    hasActiveContract: false,
    contract: null,
  },
  {
    id_site: 1004,
    site_name: '부산 물류센터',
    site_addr: '부산광역시 강서구 미음산단로 58',
    hasActiveContract: true,
    contract: { expireDate: '2027-06-30T00:00:00' },
  },
  {
    id_site: 1005,
    site_name: '광주 태양광단지',
    site_addr: '광주광역시 광산구 하남산단 6번로 107',
    hasActiveContract: true,
    contract: { expireDate: '2026-04-05T00:00:00' }, // 만료임박
  },
  {
    id_site: 1006,
    site_name: '울산 EV충전소',
    site_addr: '울산광역시 북구 산업로 915',
    hasActiveContract: false,
    contract: null,
  },
  {
    id_site: 1007,
    site_name: '성남 R&D센터',
    site_addr: '경기도 성남시 분당구 판교로 255',
    hasActiveContract: true,
    contract: { expireDate: '2027-12-31T00:00:00' },
  },
];

const DUMMY_CONTRACTS = DUMMY_SITES
  .filter((s) => s.hasActiveContract)
  .map((s, idx) => ({
    id:         idx + 1,
    id_site:    s.id_site,
    contractNo: `CTR-2025-${String(s.id_site).padStart(4, '0')}`,
    commoncode: 'C002000700020000',
    expireDate: s.contract.expireDate,
  }));

const DUMMY_DASHBOARD = {
  totalSites:     DUMMY_SITES.length,
  activeSites:    DUMMY_SITES.filter((s) => s.hasActiveContract).length,
  sites:          DUMMY_SITES,
  contracts:      DUMMY_CONTRACTS,
};

// ── 딜레이 헬퍼 (더미 모드 로딩 시뮬레이션) ─────────────────────
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ── Azure Function fetch 래퍼 ──────────────────────────────────────
async function azureFetch(action, params = {}) {
  const url = new URL(AZURE_FN_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (networkErr) {
    throw new Error(
      `Azure Function 연결 실패: ${networkErr.message}`
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`API 오류 [${response.status}]: ${errText || response.statusText}`);
  }

  const json = await response.json();

  if (json.success === false) {
    throw new Error(json.message || 'Azure Function 오류');
  }

  return json;
}

/* ══════════════════════════════════════════════════════════════════
   Public API
══════════════════════════════════════════════════════════════════ */

/** 서버 & DB 상태 확인 */
export async function fetchHealthCheck() {
  if (USE_DUMMY) {
    await delay(300);
    return {
      success: true,
      status: 'ok (dummy)',
      timestamp: new Date().toISOString(),
      db: { status: 'dummy', message: '더미 데이터 모드' },
    };
  }
  return azureFetch('health');
}

/** 계약 정보 조회 */
export async function fetchContractInfo() {
  if (USE_DUMMY) {
    await delay(400);
    return { success: true, data: DUMMY_CONTRACTS, count: DUMMY_CONTRACTS.length };
  }
  return azureFetch('contractInfo');
}

/** 현장 정보 조회 */
export async function fetchSiteInfo() {
  if (USE_DUMMY) {
    await delay(400);
    return { success: true, data: DUMMY_SITES, count: DUMMY_SITES.length };
  }
  return azureFetch('siteInfo');
}

/** 대시보드용 통합 데이터 조회 */
export async function fetchDashboardData() {
  if (USE_DUMMY) {
    await delay(500);
    return { ...DUMMY_DASHBOARD };
  }

  const result = await azureFetch('dashboard');

  // Azure Function 응답을 앱 내부 형식으로 정규화
  const rawSites = result.sites ?? result.data ?? [];
  const sites = rawSites.map((s) => ({
    id_site:           s.id_site   ?? s.idSite,
    site_name:         s.site_name ?? s.siteName ?? s.name,
    site_addr:         s.site_addr ?? s.address  ?? s.addr,
    hasActiveContract: s.hasActiveContract ?? true,
    contract: s.contract ?? (s.expireDate ? { expireDate: s.expireDate } : null),
  }));

  return {
    totalSites:  result.totalSites  ?? sites.length,
    activeSites: result.activeSites ?? sites.filter((s) => s.hasActiveContract).length,
    sites,
    contracts:   result.contracts   ?? [],
  };
}
