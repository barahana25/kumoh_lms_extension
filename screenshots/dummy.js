// 스토어 스크린샷용 가짜 chrome API와 더미 데이터.
// 실제 계정 정보는 하나도 없다. 날짜는 '지금' 기준으로 만들어 D-day가 늘 그럴듯하게 보인다.
(() => {
  const now = Date.now();
  const M = 60e3, H = 60 * M, D = 24 * H;
  const iso = (t) => new Date(t).toISOString();
  // 마감 시각을 KST 23:59로 맞춘다(오늘로부터 n일 뒤).
  const dueKst = (days, hh = 23, mm = 59) => {
    const k = new Date(now + 9 * H + days * D);
    return iso(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), hh - 9, mm));
  };

  const TERM_NOW = 20262, TERM_PREV = 20261;
  const course = (id, name, prof, code, students, termId = TERM_NOW) => ({
    id, name, shortName: name.replace(/-\d+$/, ""), code, teachers: [prof],
    term: termId === TERM_NOW ? "2026학년도 2학기" : "2026학년도 1학기", termId, students
  });
  const courses = [
    course(101, "데이터베이스설계-01", "김하늘", "2026-2-CS3101-01", 42),
    course(102, "모바일프로그래밍-02", "이도윤", "2026-2-CS3204-02", 38),
    course(103, "운영체제-01", "박서준", "2026-2-CS3002-01", 55),
    course(104, "컴퓨터네트워크-03", "최유진", "2026-2-CS3305-03", 47),
    course(105, "인공지능개론-01", "정민호", "2026-2-CS4110-01", 61),
    course(201, "자료구조-02", "한지우", "2026-1-CS2101-02", 50, TERM_PREV)
  ];

  const url = "https://canvas.kumoh.ac.kr/";
  let nid = 1000;
  const notice = (cid, title, author, ago, preview) =>
    ({ id: ++nid, cid, title, author, postedAt: iso(now - ago), url, preview });
  const announcements = [
    notice(103, "이번 주 실습실 변경 안내", "박서준", 25 * M, "이번 주 목요일 실습은 디지털관 204호에서 진행합니다. 노트북을 꼭 지참하세요."),
    notice(101, "중간고사 범위 및 시험 방식 안내", "김하늘", 3 * H, "1~7주차 강의 내용 전체가 범위입니다. 오픈북이 아니며 계산기는 사용할 수 있습니다."),
    notice(105, "팀 프로젝트 조 편성 결과", "정민호", 20 * H, "첨부한 조 편성표를 확인하고, 이번 주 금요일까지 팀장 이름을 제출해 주세요."),
    notice(102, "Flutter 개발 환경 설치 가이드", "이도윤", 30 * H, "다음 수업 전까지 Flutter SDK와 Android Studio를 설치해 오세요. 설치 영상 링크를 올려 두었습니다."),
    notice(104, "과제 2 제출 기한 연장", "최유진", 2 * D, "서버 점검으로 인해 과제 2 제출 기한을 하루 연장합니다."),
    notice(101, "보강 일정 안내", "김하늘", 3 * D, "개천절 휴강에 대한 보강은 10월 8일 오후 6시에 온라인으로 진행합니다."),
    notice(103, "퀴즈 1 결과 공개", "박서준", 4 * D, "퀴즈 1 점수를 공개했습니다. 이의 신청은 이번 주 안에 메일로 보내 주세요."),
    notice(105, "특강 안내: 생성형 AI의 현재", "정민호", 6 * D, "외부 연사 특강이 있습니다. 출석으로 인정되니 꼭 참석해 주세요."),
    notice(102, "수업 자료실 이용 안내", "이도윤", 9 * D, "주차별 강의 자료와 예제 코드는 강의자료 메뉴에 올립니다."),
    notice(104, "첫 주 수업 안내", "최유진", 16 * D, "첫 주는 오리엔테이션으로 진행합니다.")
  ];
  let aid = 2000;
  const asg = (cid, name, dueAt, submitted = false, isQuiz = false) =>
    ({ id: ++aid, cid, name, dueAt, url, submitted, isQuiz });
  const assignments = [
    asg(103, "3주차 실습 보고서", dueKst(0)),
    asg(102, "화면 설계서 제출", dueKst(1, 18, 0)),
    asg(101, "ERD 설계 과제", dueKst(2)),
    asg(104, "소켓 프로그래밍 과제", dueKst(4)),
    asg(105, "퀴즈 2: 탐색 알고리즘", dueKst(5, 10, 0), false, true),
    asg(101, "정규화 연습 문제", dueKst(6), true),
    asg(103, "스케줄러 구현 과제", dueKst(9)),
    asg(105, "팀 프로젝트 제안서", dueKst(12)),
    asg(102, "Flutter 위젯 실습", dueKst(15)),
    asg(104, "라우팅 퀴즈", dueKst(20, 12, 0), false, true),
    asg(103, "1주차 실습 보고서", dueKst(-6), true),
    asg(101, "SQL 기초 과제", dueKst(-3), true)
  ];
  let fid = 3000;
  const file = (cid, name, size, ago) =>
    ({ id: ++fid, cid, name, size, updatedAt: iso(now - ago), url });
  const files = [
    file(101, "05_정규화.pdf", 3.4e6, 40 * M),
    file(103, "04_프로세스_스케줄링.pptx", 6.1e6, 5 * H),
    file(105, "03_탐색_알고리즘.pdf", 2.2e6, 22 * H),
    file(102, "week4_example.zip", 820e3, 2 * D),
    file(104, "02_TCP_IP.pdf", 4.8e6, 4 * D),
    file(101, "04_관계대수.pdf", 2.9e6, 7 * D)
  ];

  const store = {
    cache: {
      courses, announcements, assignments, files,
      terms: [
        { id: TERM_PREV, name: "2026학년도 1학기", startAt: "2026-03-02T00:00:00Z", endAt: "2026-06-30T00:00:00Z" },
        { id: TERM_NOW, name: "2026학년도 2학기", startAt: "2026-09-01T00:00:00Z", endAt: "2026-12-31T00:00:00Z" }
      ],
      currentTermId: TERM_NOW,
      crawledTerms: { [TERM_NOW]: now },
      profile: { name: "김금오", loginId: "20260001", avatar: "" },
      updatedAt: now - 3 * M
    },
    // 몇 개는 읽음으로 두어 '새 글' 표시가 섞여 보이게 한다.
    readState: {
      announcements: { [announcements[5].id]: true, [announcements[6].id]: true },
      files: { [files[4].id]: true }
    },
    config: { pollMinutes: 30, downloadFiles: true, downloadSubdir: "KumohLMS" },
    pollStatus: { state: "ok", at: now },
    paused: false,
    ui: { termId: null }
  };
  const sync = { autoToken: { token: "dummy", id: 1 }, auto: true, keep: true };

  const get = (src) => async (def) => {
    const out = {};
    for (const k of Object.keys(def)) out[k] = k in src ? src[k] : def[k];
    return out;
  };
  window.chrome = {
    storage: {
      local: { get: get(store), set: async (o) => { Object.assign(store, o); } },
      sync: { get: get(sync), set: async (o) => { Object.assign(sync, o); } },
      onChanged: { addListener() {} }
    },
    runtime: {
      sendMessage: async () => ({ ok: true }),
      getManifest: () => ({ version: "0.3.0" })
    },
    tabs: { create() {} }
  };
})();
