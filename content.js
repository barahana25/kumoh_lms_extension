// 금오 LMS(lms.kumoh.ac.kr)를 열면 곧바로 Canvas로 넘어간다.
//
// LMS 웹의 "Canvas 열기"와 같은 절차를 밟는다.
//   1. 신원 쿠키 _linus_saml_login에 accessToken(JWT)을 심는다. IdP가 서명을 검증한다.
//   2. GET :82/api/v1/saml/redirect.do?relayState=/ 로 Canvas SSO 진입 URL을 받는다.
//   3. 그 URL로 이동하면 IdP → Canvas ACS를 거쳐 Canvas 대시보드가 열린다.
//
// 로그인 상태이면 항상 Canvas로 이동한다. 로그인 화면이면 로그인을 기다린다.
(() => {
  // :82는 API·IdP 서버다. SAML 자동 제출 페이지에서는 아무것도 하지 않는다.
  if (location.port !== '') return;

  const API = 'https://lms.kumoh.ac.kr:82/api/v1';
  const POLL_MS = 400;
  const TAG = '[금오 Canvas 바로가기]';

  const cookie = (name) => {
    const hit = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
  };

  // LMS 웹은 토큰을 sessionStorage와 쿠키 양쪽에 저장한다.
  const stored = (name) => {
    try {
      const v = sessionStorage.getItem(name);
      if (v) return v;
    } catch (_) {}
    return cookie(name);
  };

  const onLoginPage = () => /\/login(\/|$)/.test(location.pathname);

  // 새 탭은 sessionStorage가 비어 있다. 쿠키의 토큰을 sessionStorage로 옮겨 두면
  // LMS 웹이 API 요청에 인증 헤더를 붙일 수 있다. LMS 스크립트보다 먼저 실행된다.
  try {
    const access = cookie('accessToken');
    const refresh = cookie('refreshToken');
    if (access && refresh && !sessionStorage.getItem('accessToken')) {
      sessionStorage.setItem('accessToken', access);
      sessionStorage.setItem('refreshToken', refresh);
    }
  } catch (_) {}

  // SSO 진입 URL은 학교 도메인의 https 주소여야 한다. 아니면 따라가지 않는다.
  const trusted = (text) => {
    try {
      const url = new URL(text);
      return (
        url.protocol === 'https:' &&
        (url.hostname === 'kumoh.ac.kr' || url.hostname.endsWith('.kumoh.ac.kr'))
      );
    } catch (_) {
      return false;
    }
  };

  let jumping = false;

  const jump = async (access) => {
    jumping = true;
    console.info(TAG, 'Canvas로 이동합니다.');

    // LMS 웹과 같은 속성(2시간, lms.kumoh.ac.kr, SameSite=None)으로 심는다.
    const attrs = '; path=/; domain=lms.kumoh.ac.kr; max-age=7200; secure; samesite=none';
    document.cookie = `_linus_saml_login=${access}${attrs}`;
    document.cookie = `_linus_saml_domain=/${attrs}`;

    const headers = { Authorization: `Bearer ${access}` };
    const refresh = stored('refreshToken');
    if (refresh) headers['X-Refresh-Token'] = refresh;

    try {
      const res = await fetch(`${API}/saml/redirect.do?relayState=/`, {
        credentials: 'include',
        headers,
      });
      // 204는 토큰이 만료됐다는 뜻이다. 재발급은 LMS 웹에 맡기고 넘어가지 않는다.
      if (res.status !== 200) {
        console.warn(TAG, `SSO 주소 요청이 ${res.status}로 끝났습니다.`);
        return;
      }
      const url = (await res.text()).trim();
      if (!trusted(url)) {
        console.warn(TAG, `예상과 다른 SSO 주소입니다: ${url.slice(0, 60)}`);
        return;
      }
      location.replace(url);
    } catch (e) {
      console.warn(TAG, `SSO 주소 요청 오류: ${e && e.message}`);
    } finally {
      jumping = false;
    }
  };

  // 포털 SSO로 들어오면 토큰이 주소에 실려 온다.
  let urlToken = new URLSearchParams(location.search).get('accessToken');

  const tick = (auto) => {
    if (!auto || jumping) return;
    const access = urlToken || stored('accessToken');
    urlToken = null;

    // 토큰이 없거나 로그인 화면이면 다음 tick을 기다린다.
    if (!access || onLoginPage()) return;

    // 토큰이 있고 로그인 화면이 아니면 Canvas로 넘어간다.
    jump(access);
  };

  // 백그라운드가 토큰을 연장하면 이 탭의 LMS 웹도 새 토큰을 쓰게 한다.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'tokens') return;
    try {
      if (sessionStorage.getItem('accessToken')) {
        sessionStorage.setItem('accessToken', msg.access);
        sessionStorage.setItem('refreshToken', msg.refresh);
      }
    } catch (_) {}
  });

  chrome.storage.sync.get({ auto: true }, ({ auto }) => {
    tick(auto);
    setInterval(() => tick(auto), POLL_MS);
  });
})();
