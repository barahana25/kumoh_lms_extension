"""스토어 스크린샷 만들기.

    python screenshots/capture.py

- raw/   팝업 화면 그대로(400x600을 2배 해상도로, 800x1200)
- store/ Chrome 웹스토어 규격 1280x800 홍보 이미지(설명 문구 + 팝업)

더미 데이터는 dummy.js에 있다. 실제 popup.js / popup.css를 그대로 불러오므로
팝업 디자인을 고친 뒤 다시 돌리면 새 화면으로 찍힌다.
스토어 이미지는 store.html을 Chrome이 1280x800 그대로 렌더링한다. 팝업을 줄이거나
늘리지 않으므로 글자가 흐려지지 않는다. 문구와 배경은 store.html에서 고친다.
필요한 것: Chrome(또는 Edge), Python 3
"""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlencode

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
STORE = HERE / "store"

# (파일 이름, 장면, 다크 모드, 제목, 설명)
SHOTS = [
    ("1_courses", "courses", False, "수강 과목을\n한눈에", "과목마다 새 공지와\n마감 임박 과제를 표시해요"),
    ("2_assignments", "assignments", False, "마감이 급한 과제부터", "D-day로 남은 기간을 보여주고\n제출한 과제는 따로 표시해요"),
    ("3_calendar", "calendar", False, "캘린더로 보는\n마감일", "날짜를 누르면 그날 마감인\n과제를 모아 보여줘요"),
    ("4_notices", "notices", False, "새 공지와 강의자료\n놓치지 않게", "30분마다 확인해서\n새 글이 올라오면 알려드려요"),
    ("5_detail", "detail", False, "과목별로\n공지·과제·자료", "과목을 누르면 그 과목 소식만\n모아서 볼 수 있어요"),
    ("6_settings", "settings", False, "LMS에서 Canvas로\n바로 이동", "로그인 유지와 강의자료 자동 다운로드까지\nAPI 키 입력 없이 바로 써요"),
    ("7_dark", "courses", True, "다크 모드 지원", "시스템 설정에 맞춰\n어두운 화면으로 바뀌어요"),
]


def find_browser():
    candidates = [
        os.environ.get("CHROME"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit("Chrome을 찾지 못했습니다. 환경 변수 CHROME에 실행 파일 경로를 넣어 주세요.")


def shoot(browser, page, query, size, scale, dark, out):
    url = (HERE / page).as_uri() + "?" + urlencode(query)
    args = [
        browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--window-size={size[0]},{size[1]}", f"--force-device-scale-factor={scale}",
        "--virtual-time-budget=4000", "--allow-file-access-from-files",
        f"--screenshot={out}",
    ]
    if dark:
        args += ["--force-dark-mode", "--blink-settings=preferredColorScheme=0"]
    subprocess.run(args + [url], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    RAW.mkdir(exist_ok=True)
    STORE.mkdir(exist_ok=True)
    browser = find_browser()
    for name, scene, dark, title, desc in SHOTS:
        shoot(browser, "preview.html", {"scene": scene}, (400, 600), 2, dark, RAW / f"{name}.png")
        store_query = {"scene": scene, "title": title, "desc": desc, "dark": "1" if dark else "0"}
        shoot(browser, "store.html", store_query, (1280, 800), 1, dark, STORE / f"{name}.png")
        print("만듦:", name)
    print(f"\n팝업 원본: {RAW}\n스토어용 1280x800: {STORE}")


if __name__ == "__main__":
    main()
