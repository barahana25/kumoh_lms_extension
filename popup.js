// 금오 LMS 팝업. 백그라운드 폴링이 저장한 cache를 앱과 같은 화면으로 보여준다.
// 탭: 강의 / 과제 / 공지 / 설정. 강의를 누르면 과목 상세(공지·과제·자료)로 들어간다.

const CANVAS = "https://canvas.kumoh.ac.kr";
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_MS = 9 * 60 * 60 * 1000;
// 이 기간 안에 올라온 공지·자료만 '새 글'로 친다. background.js와 같은 값.
const NEW_WINDOW_MS = 14 * DAY_MS;
// 캐시가 이보다 오래되면 팝업을 열 때 새로 가져온다.
const STALE_MS = 30 * 60 * 1000;
// 공지사항 상자에 한 번에 보여줄 공지 수. 앱과 같다.
const NOTICE_PAGE = 3;
// 새 소식 확인 주기(분). background.js의 MIN_POLL_MINUTES와 맞춘다.
const MIN_POLL_MINUTES = 30;
const POLL_CHOICES = [30, 60, 120, 180];

// ---- 아이콘 (Material Icons) ----
const ICONS = {
  book: "M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z",
  assignment: "M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  campaign: "M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z",
  settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  refresh: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  open: "M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
  left: "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z",
  right: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
  file: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  login: "M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z",
  person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  folder: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  key: "M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
  schedule: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
  cloud_off: "M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z",
  quiz: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7.99 13c-.59 0-1.05-.47-1.05-1.05 0-.59.47-1.04 1.05-1.04.59 0 1.04.45 1.04 1.04-.01.58-.45 1.05-1.04 1.05zm2.5-6.17c-.63.93-1.23 1.21-1.56 1.81-.13.24-.18.4-.18 1.18h-1.52c0-.41-.06-1.08.26-1.65.41-.73 1.18-1.16 1.63-1.8.48-.68.21-1.94-1.14-1.94-.88 0-1.32.67-1.5 1.23l-1.37-.57C11.51 5.96 12.52 5 13.99 5c1.23 0 2.08.56 2.51 1.26.37.61.59 1.73.01 2.57z"
};
const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---- 날짜 (항상 KST 기준) ----
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// KST 달력 날짜를 UTC 자정 기준 Date로 표현한 값. 요일·월 계산에 쓴다.
const kstParts = (d) => {
  const k = new Date(d.getTime() + KST_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), w: k.getUTCDay(),
    hh: k.getUTCHours(), mm: k.getUTCMinutes() };
};
const kstDayNo = (d) => Math.floor((d.getTime() + KST_MS) / DAY_MS);
const pad = (n) => String(n).padStart(2, "0");

function fmtDue(iso) {
  if (!iso) return "마감 없음";
  const p = kstParts(new Date(iso));
  return `${p.m + 1}월 ${p.d}일 (${WEEKDAYS[p.w]}) ${pad(p.hh)}:${pad(p.mm)}`;
}
function fmtRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = kstDayNo(new Date()) - kstDayNo(d);
  const p = kstParts(d);
  if (diff === 0) {
    const h = p.hh % 12 || 12;
    return `${p.hh < 12 ? "오전" : "오후"} ${h}:${pad(p.mm)}`;
  }
  if (diff === 1) return "어제";
  const now = kstParts(new Date());
  return p.y === now.y ? `${p.m + 1}월 ${p.d}일` : `${p.y}. ${p.m + 1}. ${p.d}.`;
}
function ddayOf(iso) {
  if (!iso) return null;
  return kstDayNo(new Date(iso)) - kstDayNo(new Date());
}
function ddayChip(a) {
  if (a.submitted) return `<span class="chip done">${icon("check", "sm")}제출</span>`;
  const n = ddayOf(a.dueAt);
  if (n === null) return "";
  if (new Date(a.dueAt).getTime() < Date.now()) return `<span class="chip">마감</span>`;
  if (n === 0) return `<span class="chip error">D-DAY</span>`;
  if (n <= 2) return `<span class="chip error">D-${n}</span>`;
  if (n <= 7) return `<span class="chip primary">D-${n}</span>`;
  return `<span class="chip">D-${n}</span>`;
}
function fmtSize(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ---- 상태 ----
const S = {
  tab: "courses",        // courses | assignments | notices | settings
  courseId: null,        // 과목 상세를 보고 있으면 id
  courseTab: "notices",  // notices | assignments | files
  asgView: "list",       // list | calendar
  asgFilter: "todo",     // todo | all | past
  calMonth: null,        // {y, m}
  calDay: null,          // KST dayNo
  noticePage: 0,
  noticeAnim: null,      // fwd | back. 페이지를 넘긴 직후 한 번만 쓴다.
  noticeFullH: 0,        // 꽉 찬 공지 페이지의 높이(px)
  refreshing: false,
  // storage에서 읽는 값
  cache: null,
  readState: { announcements: {}, files: {} },
  config: {},
  pollStatus: null,
  paused: false,
  ui: { termId: null },  // 사용자가 고른 학기 id. 없으면 현재 학기.
  tokenKind: "none",     // auto | none
  lms: { auto: true, keep: true }  // LMS → Canvas 바로가기 설정 (storage.sync)
};

async function loadStorage() {
  const local = await chrome.storage.local.get({
    cache: null,
    readState: { announcements: {}, files: {} },
    config: {},
    pollStatus: null,
    paused: false,
    ui: { termId: null }
  });
  const sync = await chrome.storage.sync.get({ autoToken: null, auto: true, keep: true });
  S.cache = local.cache;
  S.readState = { announcements: {}, files: {}, ...(local.readState || {}) };
  S.config = local.config || {};
  S.pollStatus = local.pollStatus;
  S.paused = local.paused;
  S.ui = { termId: null, ...(local.ui || {}) };
  S.tokenKind = sync.autoToken && sync.autoToken.token ? "auto" : "none";
  S.lms = { auto: sync.auto, keep: sync.keep };
}

// ---- 데이터 조회 ----
// 학기 목록. 최근 학기가 위로 온다(시작일, 없으면 id 순).
function terms() {
  const list = [...((S.cache && S.cache.terms) || [])];
  const key = (t) => (t.startAt ? Date.parse(t.startAt) : 0);
  return list.sort((a, b) => key(b) - key(a) || b.id - a.id);
}
// 화면에 보여줄 학기 id. 사용자가 고른 학기 > 백그라운드가 정한 현재 학기.
function selectedTermId() {
  const list = terms();
  if (S.ui.termId != null && list.some((t) => t.id === S.ui.termId)) return S.ui.termId;
  if (S.cache && S.cache.currentTermId != null) return S.cache.currentTermId;
  return list.length ? list[0].id : null;
}
// 고른 학기를 아직 가져오지 않았으면 true. 예전 버전 캐시(학기 정보 없음)는 false.
function termPending() {
  const id = selectedTermId();
  return !!(S.cache && S.cache.crawledTerms && id != null && !S.cache.crawledTerms[id]);
}
function courses() {
  const all = (S.cache && S.cache.courses) || [];
  const id = selectedTermId();
  // 예전 버전 캐시에는 termId가 없다. 다음 폴링 전까지는 전부 보여준다.
  if (id == null || !all.some((c) => c.termId != null)) return all;
  return all.filter((c) => c.termId === id);
}
function courseMap() {
  return new Map(((S.cache && S.cache.courses) || []).map((c) => [c.id, c]));
}
function inTerm(cid) {
  return courses().some((c) => c.id === cid);
}
function isNewNotice(n) {
  return !S.readState.announcements[n.id] && n.postedAt &&
    Date.parse(n.postedAt) >= Date.now() - NEW_WINDOW_MS;
}
function isNewFile(f) {
  return !S.readState.files[f.id] && f.updatedAt &&
    Date.parse(f.updatedAt) >= Date.now() - NEW_WINDOW_MS;
}
function notices(cid = null) {
  const list = ((S.cache && S.cache.announcements) || [])
    .filter((n) => (cid ? n.cid === cid : inTerm(n.cid)));
  return list.sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));
}
function assignments(cid = null) {
  return ((S.cache && S.cache.assignments) || [])
    .filter((a) => (cid ? a.cid === cid : inTerm(a.cid)));
}
function files(cid = null) {
  const list = ((S.cache && S.cache.files) || [])
    .filter((f) => (cid ? f.cid === cid : inTerm(f.cid)));
  return list.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
}
const byDue = (a, b) => {
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return Date.parse(a.dueAt) - Date.parse(b.dueAt);
};
function upcoming(list) {
  const now = Date.now();
  return list.filter((a) => a.dueAt && Date.parse(a.dueAt) >= now).sort(byDue);
}
function unreadCount() {
  return notices().filter(isNewNotice).length;
}

// ---- 화면 조각 ----
function appbarMain(title) {
  const right = `
    <button class="icon-btn ${S.refreshing ? "spin" : ""}" data-act="refresh" title="새로고침">${icon("refresh")}</button>
    <button class="icon-btn" data-act="open-canvas" title="Canvas 열기">${icon("open")}</button>`;
  if (S.tab === "courses") {
    const list = terms();
    const id = selectedTermId();
    const term = list.find((t) => t.id === id);
    const chip = term ? `
      <span class="term-chip">${icon("schedule", "sm")}${esc(term.name)}${list.length > 1 ? icon("right", "sm") : ""}
        ${list.length > 1 ? `<select data-act="term">${list.map((t) =>
          `<option value="${t.id}" ${t.id === id ? "selected" : ""}>${esc(t.name)}${t.id === S.cache.currentTermId ? " (현재)" : ""}</option>`).join("")}</select>` : ""}
      </span>` : "";
    return `<header class="appbar">
      <img class="app-icon" src="assets/icon16.png"
        srcset="assets/icon16.png 16w, assets/icon48.png 48w, assets/icon128.png 128w" sizes="32px" alt="금오 LMS" />
      ${chip}<span class="spacer"></span>${right}</header>`;
  }
  return `<header class="appbar"><h1>${esc(title)}</h1>${right}</header>`;
}

function banner() {
  const st = S.pollStatus && S.pollStatus.state;
  if (!S.cache) return "";
  if (st === "login") {
    return `<div class="banner"><span class="txt">Canvas 로그인이 풀려 최신 정보를 가져오지 못했습니다.</span>
      <button data-act="login">로그인</button></div>`;
  }
  if (st === "error") {
    return `<div class="banner"><span class="txt">새로고침 중 오류가 발생했습니다.</span>
      <button data-act="refresh">다시 시도</button></div>`;
  }
  return "";
}

function emptyGate() {
  const st = S.pollStatus && S.pollStatus.state;
  if (S.paused || st === "paused") {
    return `<div class="empty">${icon("cloud_off")}
      <div class="t">연결이 해제되어 있습니다</div>
      <div class="d">다시 연결하면 로그인된 Canvas 세션으로<br/>API 키를 자동 발급해 사용합니다.</div>
      <div class="actions"><button class="btn filled" data-act="connect">${icon("login", "sm")}다시 연결</button></div></div>`;
  }
  if (S.refreshing) {
    return `<div class="empty">${icon("refresh")}
      <div class="t">강의 정보를 불러오는 중…</div>
      <div class="d">처음에는 과목 수에 따라 조금 걸릴 수 있습니다.</div></div>`;
  }
  if (st === "login" || !st) {
    return `<div class="empty">${icon("login")}
      <div class="t">Canvas에 로그인해 주세요</div>
      <div class="d">canvas.kumoh.ac.kr에 로그인되어 있으면<br/>API 키를 자동으로 발급해 사용합니다.<br/>로그인한 뒤 새로고침을 눌러 주세요.</div>
      <div class="actions">
        <button class="btn outlined" data-act="login">Canvas 로그인</button>
        <button class="btn filled" data-act="refresh">${icon("refresh", "sm")}새로고침</button>
      </div></div>`;
  }
  return `<div class="empty">${icon("cloud_off")}
    <div class="t">정보를 불러오지 못했습니다</div>
    <div class="d">${esc(S.pollStatus.message || "")}</div>
    <div class="actions"><button class="btn filled" data-act="refresh">다시 시도</button></div></div>`;
}

function termPendingView() {
  if (S.refreshing) {
    return `<div class="empty">${icon("refresh")}<div class="t">이 학기 정보를 불러오는 중…</div>
      <div class="d">과목 수에 따라 조금 걸릴 수 있습니다.</div></div>`;
  }
  return `<div class="empty">${icon("schedule")}<div class="t">아직 불러오지 않은 학기입니다</div>
    <div class="d">지난 학기는 고를 때만 불러옵니다.</div>
    <div class="actions"><button class="btn filled" data-act="refresh">${icon("refresh", "sm")}불러오기</button></div></div>`;
}
function termPendingBanner() {
  return `<div class="card" style="padding:10px 14px;margin-bottom:10px;font-size:12px;color:var(--on-surface-variant)">
    ${S.refreshing ? "이 학기의 공지·과제·강의자료를 불러오는 중…" : "이 학기의 공지·과제·강의자료는 아직 불러오지 않았습니다."}</div>`;
}

function emptyState(ic, title, desc = "") {
  return `<div class="empty">${icon(ic)}<div class="t">${esc(title)}</div>${desc ? `<div class="d">${esc(desc)}</div>` : ""}</div>`;
}

function courseCard(c) {
  const newN = notices(c.id).filter(isNewNotice).length;
  const soon = upcoming(assignments(c.id)).filter((a) => !a.submitted && ddayOf(a.dueAt) <= 3).length;
  const code = (c.code || "").split("-").slice(-2).join("-");
  const meta = [c.teachers.join(", "), c.students ? `${c.students}명` : ""].filter(Boolean).join(" · ");
  return `<button class="card course" data-act="course" data-id="${c.id}">
    <div class="name">${esc(c.name)}</div>
    <div class="meta">${esc(meta || " ")}</div>
    <div class="chips">
      ${code ? `<span class="chip">${esc(code)}</span>` : ""}
      ${newN ? `<span class="chip error">새 공지 ${newN}</span>` : ""}
      ${soon ? `<span class="chip warn">마감 임박 ${soon}</span>` : ""}
    </div></button>`;
}

// 카드 왼쪽 색 띠. 급한 과제일수록 눈에 띄게, 끝난 과제는 흐리게.
function asgAccent(a) {
  if (a.submitted) return "acc-done";
  if (!a.dueAt || Date.parse(a.dueAt) < Date.now()) return "acc-muted";
  const n = ddayOf(a.dueAt);
  if (n <= 2) return "acc-error";
  if (n <= 7) return "acc-warn";
  return "acc-primary";
}

function asgCard(a, showCourse = true) {
  const c = courseMap().get(a.cid);
  const lines = [showCourse && c ? esc(c.shortName || c.name) : "", esc(fmtDue(a.dueAt))].filter(Boolean);
  return `<button class="card asg ${a.submitted ? "submitted" : ""} ${asgAccent(a)}" data-act="url" data-url="${esc(a.url)}">
    <div class="main"><div class="title">${a.isQuiz ? "퀴즈 · " : ""}${esc(a.name)}</div>
      <div class="sub">${lines.join("<br/>")}</div></div>
    ${ddayChip(a)}</button>`;
}

function noticeRow(n, showCourse = true) {
  const c = courseMap().get(n.cid);
  const unread = isNewNotice(n);
  return `<button class="notice ${unread ? "" : "read"}" data-act="notice" data-id="${n.id}" data-url="${esc(n.url)}">
    <span class="avatar">${icon("campaign")}</span>
    <span class="main">
      <span class="top"><span class="course-name">${showCourse && c ? esc(c.shortName || c.name) : esc(n.author)}</span>
        ${esc(fmtRelative(n.postedAt))}${unread ? '<span class="dot"></span>' : ""}</span>
      <div class="title">${esc(n.title)}</div>
      ${n.preview ? `<div class="preview">${esc(n.preview)}</div>` : ""}
    </span></button>`;
}

function fileRow(f, showCourse = true) {
  const c = courseMap().get(f.cid);
  const unread = isNewFile(f);
  const sub = [showCourse && c ? c.shortName || c.name : "", fmtSize(f.size)].filter(Boolean).join(" · ");
  return `<button class="notice ${unread ? "" : "read"}" data-act="file" data-id="${f.id}" data-url="${esc(f.url)}">
    <span class="avatar">${icon("file")}</span>
    <span class="main">
      <span class="top"><span class="course-name">${esc(sub)}</span>${esc(fmtRelative(f.updatedAt))}${unread ? '<span class="dot"></span>' : ""}</span>
      <div class="title">${esc(f.name)}</div>
    </span></button>`;
}

// ---- 탭별 화면 ----
function viewCourses() {
  const list = courses();
  if (!list.length) return emptyState("book", "수강 중인 강좌가 없습니다", "새로고침을 눌러 다시 불러와 보세요.");
  return `<div class="stack">${list.map(courseCard).join("")}</div>`;
}

function viewCourseDetail() {
  const c = courseMap().get(S.courseId);
  if (!c) { S.courseId = null; return viewCourses(); }
  let body = "";
  if (S.courseTab === "notices") {
    const list = notices(c.id);
    body = list.length
      ? `<div class="card panel">${list.map((n) => noticeRow(n, false)).join("")}</div>`
      : emptyState("campaign", "공지가 없습니다");
  } else if (S.courseTab === "assignments") {
    const list = assignments(c.id).sort(byDue);
    const up = list.filter((a) => a.dueAt && Date.parse(a.dueAt) >= Date.now());
    const rest = list.filter((a) => !up.includes(a));
    body = list.length ? `
      ${up.length ? `<div class="section-title">다가오는 과제</div><div class="stack">${up.map((a) => asgCard(a, false)).join("")}</div>` : ""}
      ${rest.length ? `<div class="section-title">지난 과제 · 마감 없음</div><div class="stack">${rest.map((a) => asgCard(a, false)).join("")}</div>` : ""}`
      : emptyState("assignment", "과제가 없습니다");
  } else {
    const list = files(c.id);
    body = list.length
      ? `<div class="card panel">${list.map((f) => fileRow(f, false)).join("")}</div>`
      : emptyState("file", "강의자료가 없습니다", "교수자가 파일 메뉴를 숨긴 과목은 보이지 않을 수 있습니다.");
  }
  const tab = (id, label) => `<button class="${S.courseTab === id ? "on" : ""}" data-act="course-tab" data-id="${id}">${label}</button>`;
  return {
    header: `<header class="appbar detail">
      <button class="icon-btn" data-act="back" title="뒤로">${icon("back")}</button>
      <h1>${esc(c.name)}</h1>
      <button class="icon-btn" data-act="url" data-url="${CANVAS}/courses/${c.id}" title="Canvas에서 열기">${icon("open")}</button>
    </header>
    <nav class="tabs">${tab("notices", "공지")}${tab("assignments", "과제")}${tab("files", "강의자료")}</nav>`,
    body
  };
}

function viewAssignments() {
  const all = assignments();
  const tab = (id, label) => `<button class="${S.asgView === id ? "on" : ""}" data-act="asg-view" data-id="${id}">${label}</button>`;
  const tabs = `<nav class="tabs">${tab("list", "목록")}${tab("calendar", "캘린더")}</nav>`;
  if (S.asgView === "calendar") return { tabs, body: viewCalendar(all) };

  const f = (id, label) => `<button class="filter ${S.asgFilter === id ? "on" : ""}" data-act="asg-filter" data-id="${id}">${S.asgFilter === id ? icon("check", "sm") : ""}${label}</button>`;
  let list;
  if (S.asgFilter === "todo") list = upcoming(all).filter((a) => !a.submitted);
  else if (S.asgFilter === "all") list = upcoming(all);
  else list = all.filter((a) => a.dueAt && Date.parse(a.dueAt) < Date.now()).sort(byDue).reverse();
  const body = `<div class="filters">${f("todo", "미제출")}${f("all", "다가오는 전체")}${f("past", "지난 과제")}</div>
    ${list.length ? `<div class="stack">${list.map((a) => asgCard(a)).join("")}</div>`
      : emptyState("check", S.asgFilter === "todo" ? "남은 과제가 없습니다" : "과제가 없습니다")}`;
  return { tabs, body };
}

function viewCalendar(all) {
  const today = kstParts(new Date());
  if (!S.calMonth) S.calMonth = { y: today.y, m: today.m };
  if (S.calDay === null) S.calDay = kstDayNo(new Date());
  const { y, m } = S.calMonth;
  // 이 달 1일(KST)의 dayNo와 요일
  const firstNo = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
  const firstW = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const startNo = firstNo - firstW;
  const todayNo = kstDayNo(new Date());

  const byDay = new Map();
  for (const a of all) {
    if (!a.dueAt) continue;
    const no = kstDayNo(new Date(a.dueAt));
    if (!byDay.has(no)) byDay.set(no, []);
    byDay.get(no).push(a);
  }

  let cells = WEEKDAYS.map((w, i) => `<div class="wd ${i === 0 ? "sun" : ""}">${w}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const no = startNo + i;
    const d = new Date(no * DAY_MS);
    const inMonth = d.getUTCMonth() === m;
    if (i >= 35 && !inMonth) break;
    const items = byDay.get(no) || [];
    const dots = items.slice(0, 3).map((a) => `<i class="${a.submitted ? "done" : ""}"></i>`).join("");
    cells += `<button class="day ${inMonth ? "" : "other"} ${no === todayNo ? "today" : ""} ${no === S.calDay ? "sel" : ""}"
      data-act="cal-day" data-id="${no}"><span class="n">${d.getUTCDate()}</span><span class="dots">${dots}</span></button>`;
  }
  const sel = (byDay.get(S.calDay) || []).sort(byDue);
  const selD = new Date(S.calDay * DAY_MS);
  return `<div class="card" style="padding:12px 8px 8px">
      <div class="cal-head">
        <button class="icon-btn" data-act="cal-move" data-id="-1">${icon("left")}</button>
        <span class="month">${y}년 ${m + 1}월</span>
        <button class="icon-btn" data-act="cal-move" data-id="1">${icon("right")}</button>
      </div>
      <div class="cal">${cells}</div>
    </div>
    <div class="section-title">${selD.getUTCMonth() + 1}월 ${selD.getUTCDate()}일 (${WEEKDAYS[selD.getUTCDay()]})</div>
    ${sel.length ? `<div class="stack">${sel.map((a) => asgCard(a)).join("")}</div>`
      : `<div class="empty" style="padding:16px"><div class="d">이 날 마감인 과제가 없습니다.</div></div>`}`;
}

function noticePageCount() {
  return Math.max(1, Math.ceil(notices().length / NOTICE_PAGE));
}

// 오래된 쪽(다음 페이지)으로 넘기면 오른쪽에서, 최근 쪽이면 왼쪽에서 들어온다.
function goNoticePage(page) {
  const next = Math.max(0, Math.min(noticePageCount() - 1, page));
  if (next === S.noticePage) return;
  S.noticeAnim = next > S.noticePage ? "fwd" : "back";
  S.noticePage = next;
  render();
  S.noticeAnim = null;
}

function viewNotices() {
  const list = notices();
  const unread = list.filter(isNewNotice).length;
  const pages = noticePageCount();
  S.noticePage = Math.min(S.noticePage, pages - 1);
  const page = list.slice(S.noticePage * NOTICE_PAGE, (S.noticePage + 1) * NOTICE_PAGE);

  const fl = files().filter((f) => f.updatedAt && Date.parse(f.updatedAt) >= Date.now() - NEW_WINDOW_MS);
  const newFiles = fl.filter(isNewFile).length;

  // 덜 찬 마지막 페이지가 쪼그라들지 않게, 꽉 찬 페이지 높이만큼 채운다.
  const minH = page.length < NOTICE_PAGE && S.noticeFullH ? `style="min-height:${S.noticeFullH}px"` : "";
  const anim = S.noticeAnim ? `slide-${S.noticeAnim}` : "";

  return `<div class="card panel">
      <div class="panel-head">${icon("campaign", "sm")}공지사항${unread ? `<span class="count">${unread}</span>` : ""}
        ${unread ? `<button class="link" data-act="read-all-notices">모두 읽음</button>` : ""}</div>
      ${page.length
        ? `<div class="notice-pages ${anim}" ${minH} data-full="${page.length === NOTICE_PAGE ? 1 : 0}">${page.map((n) => noticeRow(n)).join("")}</div>`
        : `<div class="empty" style="padding:28px"><div class="d">새로운 공지가 없습니다</div></div>`}
      ${pages > 1 ? `<div class="pager">
        <button class="icon-btn" data-act="notice-page" data-id="-1" title="최근 공지" ${S.noticePage === 0 ? "disabled" : ""}>${icon("left")}</button>
        <span class="pages">${S.noticePage + 1} / ${pages}</span>
        <button class="icon-btn" data-act="notice-page" data-id="1" title="이전 공지" ${S.noticePage >= pages - 1 ? "disabled" : ""}>${icon("right")}</button></div>` : ""}
    </div>
    <div class="card panel" style="margin-top:12px">
      <div class="panel-head">${icon("file", "sm")}새 강의자료${newFiles ? `<span class="count">${newFiles}</span>` : ""}
        ${newFiles ? `<button class="link" data-act="read-all-files">모두 읽음</button>` : ""}</div>
      ${fl.length ? fl.slice(0, 10).map((f) => fileRow(f)).join("") : `<div class="empty" style="padding:20px"><div class="d">최근 2주 동안 올라온 자료가 없습니다.</div></div>`}
    </div>`;
}

function viewSettings() {
  const cfg = S.config;
  const p = (S.cache && S.cache.profile) || null;
  const avatar = p && p.avatar && !/avatar-50\.png/.test(p.avatar)
    ? `<img src="${esc(p.avatar)}" alt="" />` : icon("person");
  const profile = p ? `<div class="card profile"><span class="avatar">${avatar}</span>
      <div><div class="n">${esc(p.name)}</div><div class="s">${esc(p.loginId)}${courses().length ? ` · ${courses().length}과목` : ""}</div></div></div>` : "";

  const tokenDesc = S.tokenKind === "auto"
    ? "로그인된 Canvas 세션으로 자동 발급했습니다. 같은 Chrome 계정의 기기끼리 공유합니다."
    : S.paused ? "연결이 해제되어 있습니다." : "아직 발급하지 않았습니다. Canvas에 로그인한 뒤 새로고침하세요.";

  const poll = Math.max(MIN_POLL_MINUTES, Number(cfg.pollMinutes) || MIN_POLL_MINUTES);
  const pollLabel = (n) => (n < 60 ? `${n}분` : `${n / 60}시간`);
  const pollOpts = POLL_CHOICES.map((n) => `<option value="${n}" ${n === poll ? "selected" : ""}>${pollLabel(n)}</option>`).join("");

  const last = S.cache && S.cache.updatedAt ? new Date(S.cache.updatedAt) : null;
  const lastText = last ? `${fmtRelative(last.toISOString())} 동기화` : "동기화 기록 없음";

  return `${profile}
    <div class="group-title">알림</div>
    <div class="card group">
    <div class="row">${icon("schedule")}<div class="txt"><div class="t">새 소식 확인 주기</div>
      <div class="d">공지·과제·강의자료를 이 간격으로 확인해 알려줘요</div></div>
      <select data-act="poll">${pollOpts}</select></div>
    <button class="row" data-act="toggle-download">${icon("download")}<div class="txt"><div class="t">강의자료 자동 다운로드</div>
      <div class="d">새 강의자료를 과목별 폴더에 저장해요</div></div>
      <span class="switch ${cfg.downloadFiles ? "on" : ""}"></span></button>
    <button class="row" data-act="subdir">${icon("folder")}<div class="txt"><div class="t">저장 폴더</div>
      <div class="d">다운로드 / ${esc(cfg.downloadSubdir || "KumohLMS")}</div></div></button>
    </div>
    <div class="group-title">LMS 바로가기</div>
    <div class="card group">
    <button class="row" data-act="toggle-lms" data-id="auto">${icon("login")}<div class="txt"><div class="t">LMS에서 Canvas로 바로 이동</div>
      <div class="d">lms.kumoh.ac.kr에 로그인하면 곧바로 Canvas를 열어요</div></div>
      <span class="switch ${S.lms.auto ? "on" : ""}"></span></button>
    <button class="row" data-act="toggle-lms" data-id="keep">${icon("refresh")}<div class="txt"><div class="t">LMS 로그인 유지</div>
      <div class="d">브라우저가 켜져 있는 동안 LMS 로그인이 풀리지 않게 해요</div></div>
      <span class="switch ${S.lms.keep ? "on" : ""}"></span></button>
    </div>
    <div class="group-title">계정</div>
    <div class="card group">
    <div class="row">${icon("key")}<div class="txt"><div class="t">Canvas API 키</div><div class="d">${esc(tokenDesc)}</div></div></div>
    ${S.paused
      ? `<button class="row" data-act="connect">${icon("login")}<div class="txt"><div class="t">다시 연결</div>
          <div class="d">Canvas 세션으로 API 키를 다시 발급합니다</div></div></button>`
      : `<button class="row danger" data-act="disconnect">${icon("logout")}<div class="txt"><div class="t">연결 해제</div>
          <div class="d">자동 발급한 API 키를 Canvas에서 지우고 저장된 정보를 삭제합니다</div></div></button>`}
    </div>
    <div class="foot">${esc(lastText)} · v${esc(chrome.runtime.getManifest().version)}</div>`;
}

// ---- 렌더 ----
function render() {
  const app = document.getElementById("app");
  const titles = { courses: "강의", assignments: "과제", notices: "공지사항", settings: "설정" };
  let header = "", body = "";

  if (S.tab === "settings") {
    header = appbarMain(titles.settings);
    body = viewSettings();
  } else if (!S.cache) {
    header = appbarMain(titles[S.tab]);
    body = emptyGate();
  } else if (termPending() && (S.tab !== "courses" || S.courseId)) {
    header = S.tab === "assignments" ? appbarMain(titles.assignments) : appbarMain(titles[S.tab]);
    body = termPendingView();
  } else if (S.tab === "courses" && S.courseId) {
    const v = viewCourseDetail();
    if (typeof v === "string") { header = appbarMain(titles.courses); body = v; }
    else { header = v.header; body = v.body; }
  } else if (S.tab === "courses") {
    header = appbarMain(titles.courses);
    body = (termPending() ? termPendingBanner() : "") + viewCourses();
  } else if (S.tab === "assignments") {
    const v = viewAssignments();
    header = appbarMain(titles.assignments) + v.tabs;
    body = v.body;
  } else {
    header = appbarMain(titles.notices);
    body = viewNotices();
  }

  const unread = S.cache ? unreadCount() : 0;
  const nav = (id, ic, label, badge = 0) => `<button class="${S.tab === id ? "on" : ""}" data-act="tab" data-id="${id}">
    <span class="pill">${icon(ic)}${badge ? `<span class="badge">${badge > 99 ? "99+" : badge}</span>` : ""}</span>${label}</button>`;

  const scroll = app.querySelector(".body");
  const keepScroll = scroll && app.dataset.view === viewKey() ? scroll.scrollTop : 0;
  app.innerHTML = `<div class="topbar">${header}</div>${banner()}<main class="body">${body}</main>
    <nav class="nav">${nav("courses", "book", "강의")}${nav("assignments", "assignment", "과제")}${nav("notices", "campaign", "공지", unread)}${nav("settings", "settings", "설정")}</nav>`;
  app.dataset.view = viewKey();
  app.querySelector(".body").scrollTop = keepScroll;
  const full = app.querySelector('.notice-pages[data-full="1"]');
  if (full) S.noticeFullH = Math.max(S.noticeFullH, full.offsetHeight);
}
const viewKey = () => [S.tab, S.courseId, S.courseTab, S.asgView, S.asgFilter].join("|");

// ---- 동작 ----
async function refresh() {
  if (S.refreshing) return;
  S.refreshing = true;
  render();
  // 현재 학기가 아닌 학기를 보고 있으면 그 학기만 새로 가져온다.
  const id = selectedTermId();
  const other = S.cache && S.cache.currentTermId != null && id != null && id !== S.cache.currentTermId;
  try {
    await chrome.runtime.sendMessage({ type: "pollOnce", force: true, termId: other ? id : null });
  } catch (_) {}
  S.refreshing = false;
  await loadStorage();
  render();
}

async function markRead(kind, ids) {
  const { readState } = await chrome.storage.local.get({ readState: { announcements: {}, files: {} } });
  const next = { announcements: {}, files: {}, ...readState };
  next[kind] = { ...(next[kind] || {}) };
  for (const id of ids) next[kind][id] = true;
  await chrome.storage.local.set({ readState: next });
}

async function patchConfig(patch) {
  const { config } = await chrome.storage.local.get({ config: {} });
  await chrome.storage.local.set({ config: { ...config, ...patch } });
}

const openUrl = (url) => chrome.tabs.create({ url });

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT") return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case "tab":
      S.tab = id; S.courseId = null; render(); break;
    case "course":
      S.courseId = Number(id); S.courseTab = "notices"; render(); break;
    case "back":
      S.courseId = null; render(); break;
    case "course-tab":
      S.courseTab = id; render(); break;
    case "asg-view":
      S.asgView = id; render(); break;
    case "asg-filter":
      S.asgFilter = id; render(); break;
    case "cal-move": {
      const d = new Date(Date.UTC(S.calMonth.y, S.calMonth.m + Number(id), 1));
      S.calMonth = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
      render(); break;
    }
    case "cal-day":
      S.calDay = Number(id); render(); break;
    case "notice-page":
      goNoticePage(S.noticePage + Number(id)); break;
    case "notice":
      await markRead("announcements", [id]);
      openUrl(el.dataset.url); break;
    case "file":
      await markRead("files", [id]);
      openUrl(el.dataset.url); break;
    case "url":
      openUrl(el.dataset.url); break;
    case "read-all-notices":
      await markRead("announcements", notices().map((n) => n.id)); break;
    case "read-all-files":
      await markRead("files", files().map((f) => f.id)); break;
    case "refresh":
      refresh(); break;
    case "open-canvas":
    case "login":
      openUrl(`${CANVAS}/`); break;
    case "subdir": {
      const cur = S.config.downloadSubdir || "KumohLMS";
      const next = prompt("다운로드 폴더 아래에 만들 폴더 이름", cur);
      if (next === null) break;
      // 다운로드 API는 상대 경로만 받는다. 앞뒤 구분자와 '..'은 뺀다.
      const clean = next.trim().replace(/\\/g, "/").split("/")
        .map((x) => x.trim()).filter((x) => x && x !== "." && x !== "..").join("/");
      await patchConfig({ downloadSubdir: clean || "KumohLMS" });
      break;
    }
    case "toggle-lms":
      await chrome.storage.sync.set({ [id]: !S.lms[id] }); break;
    case "toggle-download":
      await patchConfig({ downloadFiles: !S.config.downloadFiles }); break;
    case "connect":
      S.paused = false; S.refreshing = true; render();
      try { await chrome.runtime.sendMessage({ type: "connect" }); } catch (_) {}
      S.refreshing = false; await loadStorage(); render(); break;
    case "disconnect":
      if (!confirm("자동 발급한 API 키를 Canvas에서 지우고, 저장된 강의 정보를 삭제할까요?\n같은 Chrome 계정의 다른 기기도 연결이 해제됩니다.")) break;
      try { await chrome.runtime.sendMessage({ type: "disconnect" }); } catch (_) {}
      break;
  }
});

document.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.act === "term") {
    const id = Number(el.value);
    // 현재 학기를 다시 고르면 '고른 학기'를 비워, 새 학기가 시작되면 따라가게 한다.
    S.ui.termId = S.cache && id === S.cache.currentTermId ? null : id;
    S.courseId = null;
    S.noticePage = 0;
    await chrome.storage.local.set({ ui: S.ui });
    render();
    // 처음 고른 학기면 그때 가져온다.
    if (termPending()) refresh();
  } else if (el.dataset.act === "poll") {
    await patchConfig({ pollMinutes: Number(el.value) });
  }
});

// 백그라운드가 새 데이터를 저장하거나 읽음 상태가 바뀌면 다시 그린다.
chrome.storage.onChanged.addListener(async () => {
  await loadStorage();
  render();
});

(async () => {
  await loadStorage();
  render();
  const stale = !S.cache || !S.cache.updatedAt || Date.now() - S.cache.updatedAt > STALE_MS;
  if (stale && !S.paused) refresh();
})();

// ---- 공지 페이지 넘기기: 좌우로 밀기(마우스 드래그·터치), 트랙패드 가로 스크롤, ←/→ 키 ----
let swipe = null;
let swallowClick = false;
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".notice-pages")) return;
  swipe = { x: e.clientX, y: e.clientY };
});
document.addEventListener("pointerup", (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  // 밀기로 끝난 동작이 공지를 여는 클릭으로 이어지지 않게 한다.
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 0);
  goNoticePage(S.noticePage + (dx < 0 ? 1 : -1));
});
document.addEventListener("click", (e) => {
  if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; }
}, true);

let wheelX = 0, wheelLock = 0;
document.addEventListener("wheel", (e) => {
  if (!e.target.closest(".notice-pages") || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (Date.now() < wheelLock) return;
  wheelX += e.deltaX;
  if (Math.abs(wheelX) > 60) {
    goNoticePage(S.noticePage + (wheelX > 0 ? 1 : -1));
    wheelX = 0;
    wheelLock = Date.now() + 400;  // 관성 스크롤로 여러 장 넘어가지 않게
  }
}, { passive: false });

document.addEventListener("keydown", (e) => {
  if (S.tab !== "notices" || !S.cache) return;
  if (e.key === "ArrowRight") goNoticePage(S.noticePage + 1);
  if (e.key === "ArrowLeft") goNoticePage(S.noticePage - 1);
});
