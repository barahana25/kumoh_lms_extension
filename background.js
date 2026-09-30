// ---- 위험 확장자 ----
// 실행 파일은 자동 다운로드에서 조용히 뺀다. 알림은 띄우지 않는다.
const DANGEROUS_EXTS = [
  "exe","msi","bat","cmd","ps1","vbs","scr","com",
  "js","jse","jar","msix","apk","dmg","pkg","sh","py"
];

function getExtLower(name) {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function isDangerousFile(displayName) {
  return DANGEROUS_EXTS.includes(getExtLower(displayName));
}


// ========== 파일명 중복/존재 검증 유틸 ==========

// 안전한 정규식 이스케이프
function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilenameRegexForSearch(saveAsRelative) {
  // 경로 구분은 / 또는 \ 로만 처리
  const parts = saveAsRelative.split(/[\\/]/);
  const base = parts.pop(); // 파일명
  const dir  = parts.join("[/\\\\]"); // 중간 경로 (escape 안 함)

  const m = base.match(/^(.*?)(\.[^.]+)?$/);
  const name = m?.[1] ?? base;
  const ext  = m?.[2] ?? "";

  const baseRe = `${escRe(name)}(?: \\(\\d+\\))?${escRe(ext)}`;

  // 경로 마지막이 우리가 원하는 파일명으로 끝나는지 확인
  return `.*[/\\\\]${dir ? dir + '[/\\\\]' : ""}${baseRe}$`;
}

// 이미 같은 파일이 '해당 이름'으로 존재하는지 검사
// - saveAsRelative: 우리가 지정한 상대 경로 (Downloads 하위)
// - expectedSize: 서버에 보고된 바이트 수 (없으면 null/0 전달)
async function fileAlreadyExists(saveAsRelative, expectedSize = 0) {
  const filenameRegex = buildFilenameRegexForSearch(saveAsRelative);

  const items = await chrome.downloads.search({ filenameRegex });
  console.log(filenameRegex, items);
  if (!items || items.length === 0) {
    console.log(`[info] no existing file found: ${saveAsRelative}`);
    return false;
  }

  // exists === true & state === "complete" 인 항목이 실제 디스크에 있음
  for (const it of items) {
    if (it.exists === true && it.state === "complete") {
      // 사이즈 확인(가능 시). totalBytes가 내려오면 비교
      if (expectedSize && typeof it.totalBytes === "number" && it.totalBytes > 0) {
        if (Number(it.totalBytes) === Number(expectedSize)) {
          console.log(`[info] verified size match, exists: ${saveAsRelative} (${expectedSize} bytes)`);
          return true;
        }
        // 사이즈가 다르면 '다른 버전'일 수 있으니 계속 탐색
      } else {
        // 사이즈 비교 불가 → 존재만으로도 중복 판단(보수적)
        console.log(`[warn] cannot verify size, assume exists: ${saveAsRelative}`);
        return true;
      }
    }
  }
  console.log(`[info] no matching complete file found: ${saveAsRelative}`);
  return false;
}


// ---- 유틸: 시간/배지/알림 ----

function notifyBasic(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icon128.png",
    title,
    message
  });
}

function setBadge(text) {
  chrome.action.setBadgeText({ text });
}

// ---- 날짜/타임존 도우미 (KST 기준 D-Day 계산) ----
const MS_HOUR = 3600 * 1000;
const KST_OFFSET = 9 * MS_HOUR;

function toKST(date) {
  // 9시간을 더한 Date. 이 값의 getUTC*()가 KST 벽시계 시각이다.
  // 로컬 getter(getHours 등)로 읽으면 한국 PC에서는 9시간이 한 번 더 더해지므로 쓰지 않는다.
  return new Date(date.getTime() + KST_OFFSET);
}

function parseCanvasDt(s) {
  // "2025-09-18T15:17:24Z" 또는 "+00:00" 형태
  if (!s) return null;
  try {
    // 'Z'를 '+00:00'로 치환할 필요 없이, JS Date는 ISO Z를 바로 처리 가능
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d; // UTC 기반 Date
  } catch {
    return null;
  }
}
// nowKST: Date(KST 표현), unlockUTC/dueUTC: Date(UTC)
// 반환: 3,1,0 중 하나 또는 null
function decideDDay(nowKST, unlockUTC, dueUTC, hasSubmitted) {
  if (hasSubmitted) return null;
  if (!dueUTC) return null;

  const dueKST = toKST(dueUTC);

  // 공개 시작일이 없는 과제는 처음부터 열려 있는 과제다.
  if (unlockUTC && nowKST < toKST(unlockUTC)) return null;
  if (nowKST > dueKST) return null;

  // KST 달력 날짜끼리 비교한다(자정 기준).
  const day = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dDays = Math.round((day(dueKST) - day(nowKST)) / (24 * 3600 * 1000));
  return [3, 1, 0].includes(dDays) ? dDays : null;
}

function fmtKST(d) {
  // "YYYY-MM-DD HH:mm:ss (KST)"
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} (KST)`;
}

// ---- 유틸: Link 헤더 기반 페이지네이션 처리 ----
function parseLinkHeader(link) {
  // <url>; rel="next", <...>; rel="last" ...
  if (!link) return {};
  const parts = link.split(",");
  const map = {};
  for (const p of parts) {
    const m = p.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (m) map[m[2]] = m[1];
  }
  return map;
}

async function fetchAllCanvas(apiUrl, path, headers) {
  // path 예: "/api/v1/courses"
  let url = new URL(path, apiUrl).toString();
  const out = [];
  for (let i = 0; i < 200; i++) { // 안전 루프
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Canvas API ${res.status} ${res.statusText} @ ${url}`);
    const data = await res.json();
    out.push(...data);
    const links = parseLinkHeader(res.headers.get("Link"));
    if (links.next) {
      url = links.next;
    } else {
      break;
    }
  }
  return out;
}

// ---- Canvas 토큰 자동 발급 ----
// 브라우저에 Canvas 로그인 세션이 있으면 그 세션으로 개인 액세스 토큰을 만든다.
// 세션 쿠키로 인증하는 쓰기 요청이라 Canvas가 X-CSRF-Token을 요구한다.
// 값은 쿠키 _csrf_token을 URL 디코딩한 것이다.
const CANVAS_ORIGIN_RULE_ID = 1;

// 확장이 보내는 요청의 Origin은 chrome-extension://이다. 서버가 Origin을
// 검사해도 막히지 않게, 탭이 아닌 요청(이 서비스 워커)의 토큰 요청에만
// Origin/Referer를 Canvas 주소로 바꾼다.
async function installOriginRule(apiUrl) {
  const origin = new URL(apiUrl).origin;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [CANVAS_ORIGIN_RULE_ID],
    addRules: [{
      id: CANVAS_ORIGIN_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "origin", operation: "set", value: origin },
          { header: "referer", operation: "set", value: `${origin}/` }
        ]
      },
      condition: {
        urlFilter: `|${origin}/api/v1/users/self/tokens`,
        tabIds: [chrome.tabs.TAB_ID_NONE],
        resourceTypes: ["xmlhttprequest", "other"]
      }
    }]
  });
}

async function readCanvasCsrf(apiUrl) {
  const c = await chrome.cookies.get({ url: new URL("/", apiUrl).toString(), name: "_csrf_token" });
  return c && c.value ? decodeURIComponent(c.value) : null;
}

// CSRF 쿠키가 아직 없으면 Canvas를 한 번 열어 받아온다.
async function canvasCsrf(apiUrl) {
  const existing = await readCanvasCsrf(apiUrl);
  if (existing) return existing;
  try {
    await fetch(new URL("/", apiUrl), { credentials: "include" });
  } catch (_) {}
  const warmed = await readCanvasCsrf(apiUrl);
  if (!warmed) throw new Error("Canvas CSRF 쿠키 없음");
  return warmed;
}

async function deleteCanvasToken(apiUrl, id) {
  try {
    const csrf = await canvasCsrf(apiUrl);
    await installOriginRule(apiUrl);
    await fetch(new URL(`/api/v1/users/self/tokens/${id}`, apiUrl), {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf }
    });
  } catch (_) {
    // 지우지 못하면 사용자가 Canvas 설정 → 승인된 통합에서 지울 수 있다.
  }
}

async function issueCanvasToken(apiUrl) {
  const csrf = await canvasCsrf(apiUrl);
  await installOriginRule(apiUrl);
  const suffix = Math.random().toString(16).slice(2, 6);
  const purpose = `Kumoh LMS Alarm 확장 · ${suffix}`;
  const res = await fetch(new URL("/api/v1/users/self/tokens", apiUrl), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRF-Token": csrf
    },
    body: new URLSearchParams({ "token[purpose]": purpose })
  });
  if (!res.ok) throw new Error(`Canvas 토큰 발급 실패 (${res.status})`);
  const body = await res.json();
  if (typeof body.id !== "number" || !body.visible_token) {
    throw new Error("Canvas 토큰 발급 응답이 올바르지 않음");
  }
  return { token: body.visible_token, id: body.id, purpose };
}

// 자동 토큰은 storage.sync에 둔다. 같은 Chrome 계정으로 동기화된 기기끼리
// 토큰 하나를 같이 써서, 기기마다 토큰이 새로 쌓이지 않게 한다.
// (Canvas는 발급 응답 때만 토큰 값을 주고, 이 서버는 토큰 목록 조회도 404라
// Canvas 쪽에서 기존 토큰을 찾아 다시 쓸 방법이 없다.)
async function readSharedToken() {
  const { autoToken } = await chrome.storage.sync.get({ autoToken: null });
  if (autoToken && autoToken.token) return autoToken;
  // 이전 버전은 storage.local에 저장했다. 있으면 sync로 옮긴다.
  const local = await chrome.storage.local.get({ autoToken: null });
  if (local.autoToken && local.autoToken.token) {
    await chrome.storage.sync.set({ autoToken: local.autoToken });
    await chrome.storage.local.remove("autoToken");
    return local.autoToken;
  }
  return null;
}

async function isTokenValid(apiUrl, token) {
  const res = await fetch(new URL("/api/v1/users/self", apiUrl), {
    headers: { "Authorization": `Bearer ${token}` }
  });
  return res.status !== 401;
}

// 폴링에 쓸 토큰. 공유된 자동 토큰 > 새로 발급.
async function resolveApiToken(config) {
  // 팝업에서 연결을 해제했으면 다시 연결할 때까지 발급하지 않는다.
  const { paused } = await chrome.storage.local.get({ paused: false });
  if (paused) throw new Error("연결 해제됨");
  const shared = await readSharedToken();
  if (shared) {
    if (await isTokenValid(config.apiUrl, shared.token)) return shared.token;
    // 만료되었거나 Canvas에서 지워진 토큰. 버리고 다시 발급한다.
    // 다른 기기가 먼저 새 토큰을 올렸을 수 있으니 같은 토큰일 때만 지운다.
    const now = await readSharedToken();
    if (now && now.id !== shared.id) return now.token;
    await chrome.storage.sync.remove("autoToken");
    await deleteCanvasToken(config.apiUrl, shared.id);
  }

  const issued = await issueCanvasToken(config.apiUrl);
  // 발급하는 사이 다른 기기가 먼저 올린 토큰이 있으면 그것을 쓰고 내 것은 지운다.
  const raced = await readSharedToken();
  if (raced && raced.id !== issued.id) {
    await deleteCanvasToken(config.apiUrl, issued.id);
    return raced.token;
  }
  await chrome.storage.sync.set({ autoToken: issued });
  return issued.token;
}

// ---- 상태 저장 스키마 ----
// storage.local:
// {
//   config: {
//     apiUrl, pollMinutes, downloadFiles, downloadSubdir
//   },
//   seen: {
//     assignments: { [assignment_id]: true },
//     // 과제별 D-day 알림 중복 방지: { [assignment_id]: { "3": true, "1": true, "0": true } }
//
//     assignmentNotify: { [assignment_id]: { [dDay: "3"|"1"|"0"]: true } },
//
//     lectures: { [key]: size }, // key = `${course_id}::${display_name}`
//     announcements: { [announcement_id]: true },
//     courses: { [course_id]: { name, code } }
//   },
//   lastRunAt
// }

// 새 소식 확인 주기는 30분보다 짧게 두지 않는다.
const MIN_POLL_MINUTES = 30;
const pollMinutesOf = (cfg) => Math.max(MIN_POLL_MINUTES, Number(cfg && cfg.pollMinutes) || MIN_POLL_MINUTES);

async function getConfig() {
  const def = {
    config: {
      apiUrl: "https://canvas.kumoh.ac.kr",
      pollMinutes: MIN_POLL_MINUTES,
      downloadFiles: false,
      downloadSubdir: "KumohLMS"
    },
    seen: { assignments: {}, assignmentNotify: {}, lectures: {}, announcements: {}, courses: {}, downloaded: {} },
    flags: {},
    lastRunAt: 0
  };
  const all = await chrome.storage.local.get(def);
  all.config.pollMinutes = pollMinutesOf(all.config);
  if (!all.seen.assignmentNotify) all.seen.assignmentNotify = {};
  if (!all.seen.announcements) all.seen.announcements = {};
  if (!all.flags) all.flags = {};
  return all;
}

async function setConfig(patch) {
  const cur = await chrome.storage.local.get();
  await chrome.storage.local.set({ ...cur, ...patch });
}
// ISO 문자열을 KST 문자열로 안전 변환
function asKST(iso) {
  const dUTC = parseCanvasDt(iso);
  if (!dUTC) return "없음";
  return fmtKST(toKST(dUTC));
}

// ---- 파일 다운로드 ----
async function downloadFile(url, filename) {
  // filename 예: "KumohLMS/확률및통계/강의자료/파일명.pdf"
  try {
    await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
  } catch (e) {
    console.error("download error:", e);
  }
}
// ---- 파일 다운로드 ----
async function downloadFileOnce(url, filename, seen, key) {
  try {
    // 이미 다운로드한 기록이 있으면 스킵
    if (seen.downloaded && seen.downloaded[key]) {
      console.log(`skip duplicate download: ${filename}`);
      return false;
    }

    await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: "uniquify" // 여기서도 uniquify는 동작하지만, 우리가 직접 막아줌
    });

    // 다운로드 완료 표시
    if (!seen.downloaded) seen.downloaded = {};
    seen.downloaded[key] = true;

    return true;
  } catch (e) {
    console.error("download error:", e);
    return false;
  }
}

// ---- HTML → 순수 텍스트 (줄바꿈 보존) ----
function htmlToText(html) {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // <br>, <p>, <div> → 줄바꿈 삽입
    doc.querySelectorAll("br").forEach(el => el.replaceWith("\n"));
    doc.querySelectorAll("p, div").forEach(el => {
      el.appendChild(doc.createTextNode("\n"));
    });

    let text = (doc.body && doc.body.textContent) ? doc.body.textContent : html;

    // nbsp를 일반 공백으로 교체
    text = text.replace(/\u00A0/g, " ");

    // 여러 줄바꿈 → 하나로 정리
    text = text.replace(/\n{2,}/g, "\n").trim();

    return text;
  } catch (e) {
    // 서비스 워커에는 DOMParser가 없어 여기로 온다.
    return stripHtml(html);
  }
}

// 서비스 워커에는 DOMParser가 없다. 팝업 미리보기용으로 태그만 벗긴다.
function stripHtml(html) {
  return String(html || "")
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n\s*\n+/g, "\n").trim();
}

// ---- 학기 ----
// Canvas 강좌의 term에서 학기 목록을 만든다. 날짜 없는 학기(기본 학기 등)도 포함한다.
const termIdOf = (c) => (c.term && c.term.id != null ? c.term.id : 0);

function buildTerms(courses) {
  const map = new Map();
  for (const c of courses) {
    const id = termIdOf(c);
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: (c.term && c.term.name) || "기타",
        startAt: (c.term && c.term.start_at) || null,
        endAt: (c.term && c.term.end_at) || null
      });
    }
  }
  return [...map.values()];
}

// 오늘이 들어 있는 학기. 방학이면 시작일·종료일이 오늘과 가장 가까운 학기.
// 날짜가 있는 학기가 없으면 id가 가장 큰(가장 최근에 만든) 학기.
function pickCurrentTerm(terms, now = Date.now()) {
  const dated = terms.filter(t => t.startAt && t.endAt);
  const inside = dated.find(t => Date.parse(t.startAt) <= now && now <= Date.parse(t.endAt));
  if (inside) return inside.id;
  let best = null, bestGap = Infinity;
  for (const t of dated) {
    const start = Date.parse(t.startAt), end = Date.parse(t.endAt);
    const gap = now < start ? start - now : now - end;
    if (gap < bestGap) { bestGap = gap; best = t.id; }
  }
  if (best != null) return best;
  return terms.length ? Math.max(...terms.map(t => t.id)) : null;
}

// ---- 본진 로직: 1회 폴링 ----
// 정기 폴링은 현재 학기만 가져온다. 알림과 자동 다운로드도 현재 학기만 대상이다.
// termId를 주면 그 학기만 가져온다(팝업에서 다른 학기를 골랐을 때). 현재 학기가
// 아니면 보기 전용이라 알림·다운로드 없이 캐시만 채운다.
//
// 알람과 팝업 새로고침이 겹쳐도 한 번에 하나만 돈다. 다른 학기를 요청하면
// 돌고 있는 폴링이 끝난 뒤 이어서 돈다.
let pollRunning = null;
function pollOnce(is_init = false, force = false, termId = null) {
  if (pollRunning && termId == null) return pollRunning;
  const prev = pollRunning || Promise.resolve();
  const run = prev.catch(() => {}).then(() => pollOnceInner(is_init, force, termId));
  pollRunning = run;
  run.finally(() => { if (pollRunning === run) pollRunning = null; }).catch(() => {});
  return run;
}

async function pollOnceInner(is_init = false, force = false, onlyTermId = null) {
  const state = await getConfig();
  const { config, seen } = state;

  // 처음 도는 폴링은 기존 글을 '본 것'으로만 기록하고 알림을 보내지 않는다.
  if (!state.lastRunAt) is_init = true;

  let apiToken;
  try {
    apiToken = await resolveApiToken(config);
  } catch (e) {
    console.warn("canvas token error:", e);
    // 로그인할 때까지 매 폴링마다 알리지 않도록 한 번만 알린다.
    const { paused } = await chrome.storage.local.get({ paused: false });
    await setPollStatus(paused ? "paused" : "login");
    const flags = state.flags || {};
    if (!paused && !flags.loginNoticeShown) {
      notifyBasic("Canvas 로그인 필요",
        "브라우저에서 canvas.kumoh.ac.kr에 로그인하면 API 키를 자동으로 발급합니다.");
      await chrome.storage.local.set({ flags: { ...flags, loginNoticeShown: true } });
    }
    return;
  }
  if (state.flags && state.flags.loginNoticeShown) {
    await chrome.storage.local.set({ flags: { ...state.flags, loginNoticeShown: false } });
  }

  const headers = { "Authorization": `Bearer ${apiToken}` };

  const downloadFiles = config.downloadFiles;
  const downloadSubdir = config.downloadSubdir;

  try {
    // 1) 코스 목록
    const courses = await fetchAllCanvas(config.apiUrl,
      "/api/v1/courses?include[]=teachers&include[]=term&include[]=total_students", headers);

    const terms = buildTerms(courses);
    const currentTermId = pickCurrentTerm(terms);
    const targetTermId = onlyTermId != null && terms.some(t => t.id === onlyTermId) ? onlyTermId : currentTermId;
    const isCurrent = targetTermId === currentTermId;
    const targets = courses.filter(c => termIdOf(c) === targetTermId);

    const prevCache = (await chrome.storage.local.get({ cache: null })).cache || {};
    const crawledTerms = { ...(prevCache.crawledTerms || {}) };
    // 새 학기가 처음 '현재 학기'가 되면 그 학기의 기존 글은 기록만 하고 알리지 않는다.
    // (예전 버전에서 올라온 경우 crawledTerms가 없고, seen에 이미 기록이 있다.)
    if (isCurrent && prevCache.crawledTerms && !crawledTerms[targetTermId]) is_init = true;
    const notify = isCurrent && !is_init;

    // 팝업 화면에 쓸 스냅샷
    const snap = { courses: [], assignments: [], announcements: [], files: [] };

    // 코스 이름/코드 구성: 파이썬 코드와 유사 처리
    const courseMeta = {};
    for (const c of courses) {
      const course_name = c.name ? String(c.name).split("-")[0].trim() : `Course-${c.id}`;
      const code = c.course_code
        ? String(c.course_code).split("-").slice(1).join("-").trim()
        : (c.course_code || "");
      courseMeta[c.id] = { name: course_name, code };
      seen.courses[c.id] = { name: course_name, code };
      snap.courses.push({
        id: c.id,
        name: c.name || course_name,
        shortName: course_name,
        code: c.course_code || "",
        teachers: (c.teachers || []).map(t => t.display_name).filter(Boolean),
        term: c.term && c.term.name ? c.term.name : "",
        termId: termIdOf(c),
        students: c.total_students ?? null
      });
    }

    // 2) 각 코스별 공지/과제/파일 수집
    const now = new Date();
    const nowKST = toKST(now);

    for (const c of targets) {
      const cid = c.id;
      const cname = (courseMeta[cid]?.name) || `Course-${cid}`;

      // (a) 공지 (discussion_topics?only_announcements=true)
      let topics = [];
      try {
        topics = await fetchAllCanvas(
          config.apiUrl,
          `/api/v1/courses/${cid}/discussion_topics?only_announcements=true`,
          headers
        );
      } catch (e) {
        console.warn("announcements fetch error", cid, e);
      }

      for (const t of topics) {
        const tid = t.id;
        snap.announcements.push({
          id: tid,
          cid,
          title: t.title || "",
          author: (t.author && t.author.display_name) || t.user_name || "",
          postedAt: t.posted_at || t.created_at || null,
          url: t.html_url || new URL(`/courses/${cid}/discussion_topics/${tid}`, config.apiUrl).toString(),
          preview: stripHtml(t.message).slice(0, 300)
        });
        if (!seen.announcements[tid]) {
          const postedText = asKST(t.posted_at);
          if (notify) {
            notifyBasic("새 공지", `${cname}\n${t.title}\n게시일: ${postedText}`);
          }

          seen.announcements[tid] = true;
        }
      }

      // (b) 과제
      let assignments = [];
      try {
        assignments = await fetchAllCanvas(config.apiUrl, `/api/v1/courses/${cid}/assignments?include[]=submission`, headers);
      } catch (e) {
        console.warn("assignments fetch error", cid, e);
      }
      for (const a of assignments) {
        const aid = a.id;
        const sub = a.submission || {};
        const mySubmitted = Boolean(sub.submitted_at) ||
          ["submitted", "graded", "pending_review"].includes(sub.workflow_state);
        snap.assignments.push({
          id: aid,
          cid,
          name: a.name || "",
          dueAt: a.due_at || null,
          unlockAt: a.unlock_at || null,
          lockAt: a.lock_at || null,
          points: a.points_possible ?? null,
          url: a.html_url || new URL(`/courses/${cid}/assignments/${aid}`, config.apiUrl).toString(),
          submitted: mySubmitted,
          isQuiz: Array.isArray(a.submission_types) && a.submission_types.includes("online_quiz")
        });

        // 신규 과제 등록 감지
        if (!seen.assignments[aid]) {
          // 날짜 필드
          const unlockText = asKST(a.unlock_at);
          const dueText = asKST(a.due_at);

          if (notify) {
            notifyBasic("새 과제", `${cname}\n${a.name}\n시작일: ${unlockText}\n마감일: ${dueText}`);
          }
          seen.assignments[aid] = true;
        }

        // D-Day(3/1/0) 알림 (제출했으면 스킵)
        const hasSubmitted = mySubmitted || Boolean(a.has_submitted_submissions);
        const unlockUTC = parseCanvasDt(a.unlock_at);
        const dueUTC = parseCanvasDt(a.due_at);
        const dday = decideDDay(nowKST, unlockUTC, dueUTC, hasSubmitted);

        if (dday !== null) {
          const sentMap = (seen.assignmentNotify[aid] ||= {});
          if (!sentMap[String(dday)]) {
            const dueText = dueUTC ? fmtKST(toKST(dueUTC)) : "미정";
            if (notify) {
              notifyBasic(`과제 마감 D-${dday}`, `${cname}\n${a.name}\n마감일: ${dueText}`);
            }

            sentMap[String(dday)] = true; // 동일 과제/디데이 중복 방지
          }
        }
      }

      // (c) 파일(강의자료)
      let files = [];
      try {
        files = await fetchAllCanvas(config.apiUrl, `/api/v1/courses/${cid}/files`, headers);
      } catch (e) {
        console.warn("files fetch error", cid, e);
      }

      const courseDir = `${downloadSubdir}/${cname}`;
      for (const f of files) {
        if (f.locked_for_user === true) continue;

        const displayName = f.display_name || f.filename || `file-${f.id}`;
        snap.files.push({
          id: f.id,
          cid,
          name: displayName,
          size: Number(f.size || 0),
          updatedAt: f.updated_at || f.created_at || null,
          url: new URL(`/courses/${cid}/files/${f.id}`, config.apiUrl).toString()
        });
        const size = Number(f.size || 0);
        const key = `${cid}::${displayName}`;

        // 변동 감지 메시지/seen 갱신은 기존 로직 그대로…
        const had = Object.prototype.hasOwnProperty.call(seen.lectures, key);
        const firstSeen = !had;
        const prevSize = had ? Number(seen.lectures[key]) : null;
        const changed  = had && prevSize !== Number(size);
        if (firstSeen) {
          if (notify) {
            notifyBasic("새 강의자료", `${cname}\n${displayName}`);
          }
        } else if (changed) {
          if (notify) {
            notifyBasic("변경된 강의자료", `${cname}\n${displayName}`);
          }
        }

        const download = downloadFiles && isCurrent && f.url;
        if (download && isDangerousFile(displayName)) {
          console.log(`[skip-danger] ${displayName}`);
        } else if (download) {
          const lower = displayName.toLowerCase();
          const isDoc = ["pdf", "ppt", "pptx", "doc", "docx", "hwp"].some(ext => lower.endsWith(`.${ext}`));
          const sub = isDoc ? "강의자료" : "기타파일";
          const saveAs = `${courseDir}/${sub}/${displayName}`;

          // 🔒 중복 검사: 브라우저/확장 재시작 이후에도 디스크에 같은 이름이 있으면 스킵
          const exists = await fileAlreadyExists(saveAs, size);
          if (exists) {
            console.log(`[skip] already exists on disk: ${saveAs}`);
          } else {
            console.log(`[download] ${f.url} -> ${saveAs}`);
            // 중복 생성 방지: 같은 이름 있으면 덮어쓰기(원하면 "overwrite", 중복 방지용)
            await chrome.downloads.download({
              url: f.url,
              filename: saveAs,
              saveAs: false,
              conflictAction: "overwrite"
            });
          }
        }

        if (!seen.downloaded) seen.downloaded = {};
        // seen 업데이트는 그대로
        seen.lectures[key] = size;
      }
    }

    // 내 프로필 (설정 화면의 이름·학번)
    let profile = null;
    try {
      const r = await fetch(new URL("/api/v1/users/self/profile", config.apiUrl), { headers });
      if (r.ok) {
        const p = await r.json();
        profile = { name: p.name || p.short_name || "", loginId: p.login_id || "", avatar: p.avatar_url || "" };
      }
    } catch (_) {}

    // 상태 저장
    await setConfig({
      seen,
      lastRunAt: Date.now(),
      cache: mergeCache(prevCache, snap, {
        terms,
        currentTermId,
        crawledCourseIds: new Set(targets.map(c => c.id)),
        crawledTerms: { ...crawledTerms, [targetTermId]: Date.now() },
        profile: profile || prevCache.profile || null
      })
    });
    await updateUnreadBadge();
    await setPollStatus("ok");

  } catch (e) {
    console.error(e);
    await setPollStatus("error", String(e && e.message || e));
    if (!force) notifyBasic("LMS 폴링 에러", String(e));
  }
}

// 이번에 가져온 강좌의 글만 새로 바꾸고, 다른 학기에서 가져와 둔 글은 그대로 둔다.
// 강좌 목록에서 사라진 강좌의 글은 버린다.
function mergeCache(prev, snap, { terms, currentTermId, crawledCourseIds, crawledTerms, profile }) {
  const alive = new Set(snap.courses.map(c => c.id));
  const keep = (list) => (list || []).filter(x => alive.has(x.cid) && !crawledCourseIds.has(x.cid));
  return {
    courses: snap.courses,
    terms,
    currentTermId,
    crawledTerms,
    announcements: [...keep(prev.announcements), ...snap.announcements],
    assignments: [...keep(prev.assignments), ...snap.assignments],
    files: [...keep(prev.files), ...snap.files],
    profile,
    updatedAt: Date.now()
  };
}

// 팝업이 보여줄 마지막 폴링 결과. ok | login | paused | error
async function setPollStatus(stateName, message = "") {
  await chrome.storage.local.set({ pollStatus: { state: stateName, message, at: Date.now() } });
}

// 팝업의 '연결 해제': 공유 토큰을 Canvas에서 지우고, 다시 연결할 때까지 발급을 멈춘다.
async function disconnect() {
  const { config } = await getConfig();
  const shared = await readSharedToken();
  await chrome.storage.local.set({ paused: true });
  if (shared) await deleteCanvasToken(config.apiUrl, shared.id);
  await chrome.storage.sync.remove("autoToken");
  await chrome.storage.local.remove(["cache", "readState"]);
  await setPollStatus("paused");
  setBadge("");
}

// ---- 읽지 않은 공지 수 → 아이콘 배지 ----
// 최근 14일 안에 올라온 공지 중 팝업에서 열어보지 않은 것.
const UNREAD_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
async function updateUnreadBadge() {
  const { cache, readState } = await chrome.storage.local.get({ cache: null, readState: { announcements: {} } });
  if (!cache) return setBadge("");
  const read = (readState && readState.announcements) || {};
  const since = Date.now() - UNREAD_WINDOW_MS;
  const current = new Set((cache.courses || [])
    .filter(c => cache.currentTermId == null || c.termId === cache.currentTermId).map(c => c.id));
  const n = cache.announcements.filter(a =>
    current.has(a.cid) && !read[a.id] && a.postedAt && Date.parse(a.postedAt) >= since).length;
  chrome.action.setBadgeBackgroundColor({ color: "#BA1A1A" });
  setBadge(n ? String(n) : "");
}

// ---- 알람 스케줄 & 트리거 ----
async function setupAlarms() {
  const { config } = await getConfig();
  // 예전 버전의 짧은 주기가 저장돼 있으면 30분 이상으로 올려 둔다.
  if (config.pollMinutes !== Number((await chrome.storage.local.get({ config: {} })).config.pollMinutes)) {
    await setConfig({ config });
  }
  chrome.alarms.create("poll", { periodInMinutes: config.pollMinutes });
  await lmsSetup();
}
chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.readState) updateUnreadBadge();
  if (changes.config && changes.config.newValue) {
    const cfg = changes.config.newValue;
    chrome.alarms.create("poll", { periodInMinutes: pollMinutesOf(cfg) });
  }
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "poll") pollOnce();
  if (a.name === LMS_ALARM) lmsRunOnce();
});

// 아이콘 클릭 → 즉시 폴링
// chrome.action.onClicked.addListener(() => {
//   pollOnce();
// });

// 팝업에서 보낸 요청 처리
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "pollOnce") {
    pollOnce(msg.is_init === true, msg.force === true, msg.termId ?? null)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true; // keep channel open
  }
  if (msg && msg.type === "disconnect") {
    disconnect()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg && msg.type === "connect") {
    chrome.storage.local.set({ paused: false })
      .then(() => pollOnce(false, true))
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});

// ==== 금오 LMS 로그인 유지 (구 '금오 LMS → Canvas 바로가기') ====
//
// LMS의 accessToken은 60분, refreshToken은 120분짜리다. 만료된 accessToken을
// 가진 채로 LMS를 열면 서버가 토큰 쿠키를 전부 지우고 로그인 화면을 띄운다.
// 로그인 직후 Canvas로 넘어가면 LMS 페이지가 토큰을 재발급할 기회가 없으므로,
// 브라우저가 켜져 있는 동안 여기서 만료 전에 재발급해 쿠키에 다시 넣는다.
//
// 서버는 계정당 가장 최근 refreshToken만 받아 준다. 다른 곳(휴대폰 앱 등)에서
// 로그인하면 여기 토큰은 더 이상 재발급되지 않고, 그때는 조용히 멈춘다.
// LMS를 열면 Canvas로 넘기는 부분은 content.js에 있다.

const LMS = "https://lms.kumoh.ac.kr";
const LMS_API = "https://lms.kumoh.ac.kr:82/api/v1";
const LMS_ALARM = "lms-keepalive";
const LMS_PERIOD_MIN = 5;
// accessToken이 이만큼보다 적게 남으면 재발급한다.
const LMS_RENEW_BEFORE_MS = 20 * 60 * 1000;
// 서버가 CORS로 chrome-extension:// Origin을 거부한다. 탭이 아닌 요청(이 서비스
// 워커)의 재발급 요청에만 Origin을 LMS 웹과 같게 바꾼다.
const LMS_ORIGIN_RULE_ID = 2;

const lmsLog = (step, detail = "") => console.info("[금오 LMS 로그인 유지]", step, detail);

const jwtExp = (token) => {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(atob(part)).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch (_) {
    return null;
  }
};

const lmsKeepEnabled = async () => (await chrome.storage.sync.get({ keep: true })).keep;

async function installLmsOriginRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [LMS_ORIGIN_RULE_ID],
    addRules: [{
      id: LMS_ORIGIN_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "origin", operation: "set", value: LMS },
          { header: "referer", operation: "set", value: `${LMS}/` }
        ]
      },
      condition: {
        urlFilter: "|https://lms.kumoh.ac.kr:82/api/v1/reissue",
        tabIds: [chrome.tabs.TAB_ID_NONE],
        resourceTypes: ["xmlhttprequest", "other"]
      }
    }]
  });
}

const getLmsCookie = (name) => chrome.cookies.get({ url: `${LMS}/`, name });

// 원래 쿠키의 속성(경로, 보안, 만료 등)을 그대로 두고 값만 바꾼다.
async function replaceCookie(old, value) {
  const next = {
    url: `${LMS}${old.path}`,
    name: old.name,
    value,
    path: old.path,
    secure: old.secure,
    httpOnly: old.httpOnly,
    sameSite: old.sameSite,
    storeId: old.storeId
  };
  if (!old.hostOnly) next.domain = old.domain;
  if (!old.session && old.expirationDate) next.expirationDate = old.expirationDate;
  await chrome.cookies.set(next);
}

async function lmsReissue(access, refresh) {
  await installLmsOriginRule();
  const res = await fetch(`${LMS_API}/reissue`, {
    method: "POST",
    credentials: "omit",
    headers: { Authorization: `Bearer ${access}`, "X-Refresh-Token": refresh }
  });
  let body = null;
  try {
    body = await res.json();
  } catch (_) {}
  const data = body && body.data;
  if (res.status !== 200 || !data || !data.accessToken || !data.refreshToken) {
    const code = body && body.code ? ` ${body.code}` : "";
    throw new Error(`재발급 실패 (${res.status}${code})`);
  }
  return { access: data.accessToken, refresh: data.refreshToken };
}

// 열려 있는 LMS 탭의 sessionStorage도 새 토큰으로 맞춘다. 안 그러면 그 탭이
// 나중에 옛 refreshToken으로 재발급하다 실패해 로그아웃된다.
async function broadcastLmsTokens(tokens) {
  const tabs = await chrome.tabs.query({ url: `${LMS}/*` });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: "tokens", ...tokens }).catch(() => {});
  }
}

// accessToken이 곧 만료되면 재발급해 쿠키와 열린 LMS 탭에 넣는다.
async function lmsKeepAlive() {
  if (!(await lmsKeepEnabled())) return false;
  const [accessCookie, refreshCookie] = await Promise.all([
    getLmsCookie("accessToken"),
    getLmsCookie("refreshToken")
  ]);
  if (!accessCookie || !refreshCookie) return false;
  const access = accessCookie.value;
  const refresh = refreshCookie.value;
  if (!access || !refresh) return false;

  const now = Date.now();
  const accessExp = jwtExp(access);
  const refreshExp = jwtExp(refresh);
  if (refreshExp && refreshExp <= now) return false;
  if (accessExp && accessExp - now > LMS_RENEW_BEFORE_MS) return true;

  try {
    const next = await lmsReissue(access, refresh);
    await replaceCookie(accessCookie, next.access);
    await replaceCookie(refreshCookie, next.refresh);
    await broadcastLmsTokens(next);
    const until = new Date(jwtExp(next.access) || now).toLocaleTimeString("ko-KR");
    lmsLog("연장함", `${until}까지 유효`);
    return true;
  } catch (e) {
    lmsLog("연장 못 함", `${e.message}. 다른 기기에서 로그인했으면 LMS에서 다시 로그인해야 합니다.`);
    return false;
  }
}

let lmsRunning = null;
const lmsRunOnce = () => {
  lmsRunning = (lmsRunning || Promise.resolve())
    .catch(() => {})
    .then(() => lmsKeepAlive());
  return lmsRunning;
};

async function lmsSetup() {
  await installLmsOriginRule();
  await chrome.alarms.create(LMS_ALARM, { periodInMinutes: LMS_PERIOD_MIN });
  lmsRunOnce();
}

// 팝업에서 '로그인 유지'를 켜면 바로 한 번 확인한다.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.keep && changes.keep.newValue) lmsRunOnce();
});
