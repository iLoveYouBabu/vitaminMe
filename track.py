#!/usr/bin/env python3

import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path


# 추적할 멜론 곡 번호
SONG_ID = "602540014"

# 곡 정보
SONG_TITLE = "Vitamin ME"
ARTIST = "프로미스나인"

# 멜론 차트 주소
# 시간당차트
CHART_URL = "https://www.melon.com/chart/index.htm"
# 일간차트
DAILY_CHART_URL = "https://www.melon.com/chart/day/index.htm"

# 일반 웹브라우저처럼 요청하기 위한 헤더
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    ),
    "Referer": "https://www.melon.com/",
    "Accept-Language": "ko-KR,ko;q=0.9",
}


# 가이섬용
GUYSO_URL = (
    "https://xn--o39an51b2re.com/"
    f"chart/melon/daily/trend/ranking/{SONG_ID}"
)

# 가이섬용
GUYSO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

# 저장할 JSON 파일 위치
DATA_FILE = (
    Path(__file__).parent
    / "docs"
    / "data"
    / "chart.json"
)

# 한국 시간
KST = timezone(timedelta(hours=9))


def download_html(
    url: str,
    headers: dict | None = None,
) -> str:
    """지정한 페이지의 HTML을 가져옵니다."""

    request = urllib.request.Request(
        url,
        headers=headers or HEADERS,
    )

    with urllib.request.urlopen(
        request,
        timeout=30,
    ) as response:
        return response.read().decode(
            "utf-8",
            errors="ignore",
        )
    

def download_chart_html() -> str:
    """멜론 TOP100 페이지 HTML을 가져옵니다."""

    return download_html(CHART_URL)


def download_daily_chart_html() -> str:
    """멜론 최신 일간 차트 페이지 HTML을 가져옵니다."""

    return download_html(DAILY_CHART_URL)


def download_guyso_html() -> str:
    """가이섬의 곡별 일간 추이 HTML을 가져옵니다."""

    return download_html(
        GUYSO_URL,
        headers=GUYSO_HEADERS,
    )


def find_song_rank(
    page_html: str,
) -> int | None:
    """
    멜론 차트 HTML에서 대상 곡의 순위를 찾습니다.

    반환값:
    - 1~100: 차트 순위
    - None: 100곡은 정상적으로 읽었지만 대상 곡이 없음
    """

    rows = re.split(
        (
            r'<tr[^>]*class=["\']'
            r'[^"\']*\blst(?:50|100)\b'
            r'[^"\']*["\'][^>]*>'
        ),
        page_html,
        flags=re.IGNORECASE,
    )[1:]

    # 페이지 구조가 바뀌거나 차트를 제대로 받지 못한 경우
    # 차트 아웃으로 잘못 저장하지 않도록 실패 처리
    if len(rows) < 90:
        raise RuntimeError(
            "멜론 차트에서 곡 행을 충분히 "
            f"찾지 못했습니다: {len(rows)}개"
        )

    for row in rows:
        song_match = re.search(
            r'data-song-no=["\'](\d+)["\']',
            row,
            flags=re.IGNORECASE,
        )

        if not song_match:
            continue

        if song_match.group(1) != SONG_ID:
            continue

        rank_match = re.search(
            (
                r'<span[^>]*class=["\']'
                r'[^"\']*\brank\b'
                r'[^"\']*["\'][^>]*>'
                r'\s*(\d+)\s*</span>'
            ),
            row,
            flags=re.IGNORECASE,
        )

        if not rank_match:
            raise RuntimeError(
                "대상 곡은 찾았지만 "
                "순위를 읽지 못했습니다."
            )

        return int(rank_match.group(1))

    # 100곡은 정상적으로 읽었지만 대상 곡이 없으면 차트 아웃
    return None


def find_daily_chart_date(
    page_html: str,
) -> str:
    """
    일간 차트 페이지의 실제 기준일을
    YYYY-MM-DD 형식으로 반환합니다.

    예:
    2026.07.31 장르종합
    -> 2026-07-31
    """

    # script와 style 내용을 먼저 제거
    plain_text = re.sub(
        r"<script\b[^>]*>.*?</script>",
        " ",
        page_html,
        flags=(
            re.IGNORECASE
            | re.DOTALL
        ),
    )

    plain_text = re.sub(
        r"<style\b[^>]*>.*?</style>",
        " ",
        plain_text,
        flags=(
            re.IGNORECASE
            | re.DOTALL
        ),
    )

    # HTML 태그 제거
    plain_text = re.sub(
        r"<[^>]+>",
        " ",
        plain_text,
    )

    # &nbsp; 같은 HTML 문자 변환
    plain_text = unescape(plain_text)

    # 여러 공백을 하나로 정리
    plain_text = re.sub(
        r"\s+",
        " ",
        plain_text,
    )

    date_match = re.search(
        (
            r"(20\d{2})"
            r"[.\-](\d{2})"
            r"[.\-](\d{2})"
            r"\s*장르종합"
        ),
        plain_text,
    )

    if not date_match:
        raise RuntimeError(
            "멜론 일간 차트의 "
            "기준 날짜를 찾지 못했습니다."
        )

    year, month, day = date_match.groups()

    return f"{year}-{month}-{day}"




class GuysoTableParser(HTMLParser):
    """가이섬 HTML 표의 행과 셀을 읽습니다."""

    def __init__(self):
        super().__init__()

        self.rows = []
        self.current_row = None
        self.current_cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.current_row = []

        elif (
            tag in ("td", "th")
            and self.current_row is not None
        ):
            self.current_cell = []

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell.append(data)

    def handle_endtag(self, tag):
        if (
            tag in ("td", "th")
            and self.current_cell is not None
            and self.current_row is not None
        ):
            text = " ".join(
                "".join(self.current_cell).split()
            )

            self.current_row.append(text)
            self.current_cell = None

        elif (
            tag == "tr"
            and self.current_row is not None
        ):
            if self.current_row:
                self.rows.append(
                    self.current_row
                )

            self.current_row = None


def parse_guyso_listener_history(
    page_html: str,
) -> dict[str, int]:
    """
    가이섬 추이 페이지에서 날짜별 이용자 수만 읽습니다.

    반환 예:
    {
        "2026-07-21": 36747,
        "2026-07-22": 36597
    }

    가이섬의 순위 값은 사용하지 않습니다.
    """

    parser = GuysoTableParser()
    parser.feed(page_html)

    listener_history = {}

    for row in parser.rows:
        # 테스트로 확인한 표 구조:
        # 0번 칸 날짜
        # 1번 칸 순위
        # 2번 칸 이용자 수
        if len(row) < 3:
            continue

        raw_date = re.sub(
            r"[^0-9]",
            "",
            row[0],
        )

        if not re.fullmatch(
            r"20\d{6}",
            raw_date,
        ):
            continue

        listeners_match = re.search(
            r"[\d,]+",
            row[2],
        )

        if not listeners_match:
            continue

        chart_date = (
            f"{raw_date[0:4]}-"
            f"{raw_date[4:6]}-"
            f"{raw_date[6:8]}"
        )

        listeners = int(
            listeners_match
            .group()
            .replace(",", "")
        )

        listener_history[chart_date] = (
            listeners
        )

    if not listener_history:
        raise RuntimeError(
            "가이섬에서 이용자 수 데이터를 "
            "찾지 못했습니다."
        )

    return dict(
        sorted(
            listener_history.items()
        )
    )




def load_data() -> dict:
    """기존 chart.json을 읽습니다."""

    if not DATA_FILE.exists():
        return {
            "song": {
                "songId": SONG_ID,
                "title": SONG_TITLE,
                "artist": ARTIST,
            },
            "history": [],
            "dailyHistory": [],
        }

    with DATA_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def save_rank(
    rank: int | None,
) -> None:
    """현재 시간의 순위를 로컬 chart.json에 저장합니다."""

    data = load_data()

    data["song"] = {
        "songId": SONG_ID,
        "title": SONG_TITLE,
        "artist": ARTIST,
    }

    history = data.setdefault(
        "history",
        [],
    )

    # 일간 배열이 아직 없어도 자동 생성
    data.setdefault(
        "dailyHistory",
        [],
    )

    now = datetime.now(KST)

    # 15시 7분에 실행해도 15:00으로 저장
    charted_at = now.replace(
        minute=0,
        second=0,
        microsecond=0,
    )

    charted_at_text = (
        charted_at.isoformat(
            timespec="seconds",
        )
    )

    new_record = {
        "chartedAt": charted_at_text,
        "rank": rank,
    }

    # 같은 시간 기록 제거
    history = [
        record
        for record in history
        if record.get("chartedAt")
        != charted_at_text
    ]

    history.append(new_record)

    history.sort(
        key=lambda record:
        record["chartedAt"]
    )

    data["history"] = history

    DATA_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with DATA_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )

    rank_text = (
        "차트 아웃"
        if rank is None
        else f"{rank}위"
    )

    print(
        f"저장 완료: {charted_at_text} / "
        f"{SONG_TITLE} / {rank_text}"
    )


def main() -> None:
    page_html = download_chart_html()
    rank = find_song_rank(page_html)
    save_rank(rank)


if __name__ == "__main__":
    main()