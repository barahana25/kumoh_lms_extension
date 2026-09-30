// ?scene=이름 으로 팝업의 시작 화면을 고른다. popup.js의 상태(S)와 render()를 그대로 쓴다.
const SCENES = {
  courses: { tab: "courses" },
  assignments: { tab: "assignments", asgView: "list", asgFilter: "todo" },
  calendar: { tab: "assignments", asgView: "calendar" },
  notices: { tab: "notices" },
  detail: { tab: "courses", courseId: 101, courseTab: "assignments" },
  settings: { tab: "settings" }
};

window.addEventListener("load", () => setTimeout(() => {
  const name = new URLSearchParams(location.search).get("scene") || "courses";
  Object.assign(S, SCENES[name] || SCENES.courses);
  render();
  document.body.dataset.ready = "1";
}, 200));
