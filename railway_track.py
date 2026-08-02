#!/usr/bin/env python3

import base64
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta

from track import (
    ARTIST,
    KST,
    SONG_ID,
    SONG_TITLE,
    download_chart_html,
    download_daily_chart_html,
    download_guyso_html,
    find_daily_chart_date,
    find_song_rank,
    parse_guyso_listener_history,
)


OWNER = "iLoveYouBabu"
REPO = "vitaminMe"
BRANCH = "main"
FILE_PATH = "docs/data/chart.json"

# 한국 시간 14시 이후부터 일간 차트를 확인
DAILY_CHECK_HOUR = 14

# Railway가 01분, 06분, 11분...에 실행되므로
# 이용자 수가 늦게 올라올 때 매시간 01분 실행에서 재확인
LISTENER_CHECK_MINUTE_LIMIT = 5

API_URL = (
    f"https://api.github.com/repos/"
    f"{OWNER}/{REPO}/contents/{FILE_PATH}"
)


def github_api(
    method: str,
    url: str,
    payload: dict | None = None,
) -> dict:
    token = os.getenv("GITHUB_TOKEN")

    if not token:
        raise RuntimeError(
            "GITHUB_TOKEN이 설정되지 않았습니다."
        )

    body = None

    if payload is not None:
        body = json.dumps(
            payload,
        ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Accept":
                "application/vnd.github+json",

            "Authorization":
                f"Bearer {token}",

            "X-GitHub-Api-Version":
                "2022-11-28",

            "User-Agent":
                "vitamin-me-railway",

            "Content-Type":
                "application/json",
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=30,
        ) as response:
            text = (
                response
                .read()
                .decode("utf-8")
            )

            return (
                json.loads(text)
                if text
                else {}
            )

    except urllib.error.HTTPError as error:
        detail = (
            error
            .read()
            .decode(
                "utf-8",
                errors="ignore",
            )
        )

        raise RuntimeError(
            f"GitHub API 오류: "
            f"{error.code} / {detail}"
        ) from error


def update_hourly_rank(
    data: dict,
    now: datetime,
    rank: int | None,
) -> tuple[bool, str]:
    """
    현재 시간의 TOP100 순위를 data에 반영합니다.

    반환값:
    - 변경 여부
    - 저장 시간
    """

    history = data.setdefault(
        "history",
        [],
    )

    charted_at = (
        now.replace(
            minute=0,
            second=0,
            microsecond=0,
        )
        .isoformat(
            timespec="seconds",
        )
    )

    existing = next(
        (
            item
            for item in history
            if item.get("chartedAt")
            == charted_at
        ),
        None,
    )

    # 같은 시간에 같은 순위가 이미 있으면 변경하지 않음
    if (
        existing is not None
        and existing.get("rank") == rank
    ):
        return False, charted_at

    new_record = {
        "chartedAt": charted_at,
        "rank": rank,
    }

    # 기존 기록에 freeze가 있으면 유지
    if (
        existing is not None
        and "freeze" in existing
    ):
        new_record["freeze"] = (
            existing["freeze"]
        )

    # 같은 시간의 기존 기록 제거
    history = [
        item
        for item in history
        if item.get("chartedAt")
        != charted_at
    ]

    history.append(new_record)

    history.sort(
        key=lambda item:
        item["chartedAt"]
    )

    data["history"] = history

    return True, charted_at



def merge_guyso_listeners(
    data: dict,
) -> tuple[int, int]:
    """
    가이섬 이용자 수를 dailyHistory에 병합합니다.

    가이섬의 순위는 사용하지 않고
    listeners 값만 반영합니다.

    반환값:
    - 실제로 변경된 기록 수
    - 가이섬에서 찾은 전체 이용자 기록 수
    """

    daily_history = data.setdefault(
        "dailyHistory",
        [],
    )

    guyso_html = download_guyso_html()

    listener_history = (
        parse_guyso_listener_history(
            guyso_html
        )
    )

    updated_count = 0

    for record in daily_history:
        chart_date = record.get(
            "chartDate"
        )

        if not chart_date:
            continue

        if chart_date not in listener_history:
            continue

        listeners = listener_history[
            chart_date
        ]

        # 이미 동일한 숫자가 있으면 변경하지 않음
        if (
            record.get("listeners")
            == listeners
        ):
            continue

        record["listeners"] = listeners
        updated_count += 1

    return (
        updated_count,
        len(listener_history),
    )


def update_daily_rank(
    data: dict,
    now: datetime,
) -> tuple[bool, str]:
    """
    멜론 공식 웹에서 일간 순위를 저장하고,
    가이섬에서는 이용자 수만 병합합니다.
    """

    daily_history = data.setdefault(
        "dailyHistory",
        [],
    )

    if now.hour < DAILY_CHECK_HOUR:
        return (
            False,
            f"{DAILY_CHECK_HOUR}시 전이라 "
            "일간 확인 생략",
        )

    expected_date = (
        now.date()
        - timedelta(days=1)
    ).isoformat()

    changed = False
    rank_changed = False
    messages = []

    expected_record = next(
        (
            item
            for item in daily_history
            if item.get("chartDate")
            == expected_date
        ),
        None,
    )

    if expected_record is None:
        daily_html = (
            download_daily_chart_html()
        )

        daily_chart_date = (
            find_daily_chart_date(
                daily_html
            )
        )

        if daily_chart_date != expected_date:
            messages.append(
                "멜론 일간 차트 미갱신 "
                f"(현재 {daily_chart_date})"
            )

        else:
            daily_rank = find_song_rank(
                daily_html
            )

            expected_record = {
                "chartDate":
                    daily_chart_date,

                "rank":
                    daily_rank,
            }

            daily_history.append(
                expected_record
            )

            daily_history.sort(
                key=lambda item:
                item["chartDate"]
            )

            changed = True
            rank_changed = True

            rank_text = (
                "차트 아웃"
                if daily_rank is None
                else f"{daily_rank}위"
            )

            messages.append(
                f"{daily_chart_date} "
                f"일간 {rank_text} 저장"
            )

    else:
        saved_rank = expected_record.get(
            "rank"
        )

        saved_rank_text = (
            "차트 아웃"
            if saved_rank is None
            else f"{saved_rank}위"
        )

        messages.append(
            f"{expected_date} "
            f"일간 이미 저장됨 "
            f"({saved_rank_text})"
        )

    missing_listener_dates = [
        item.get("chartDate")
        for item in daily_history
        if (
            item.get("chartDate")
            and "listeners" not in item
        )
    ]

    should_check_listeners = (
        bool(missing_listener_dates)
        and (
            rank_changed
            or len(missing_listener_dates) > 1
            or (
                now.minute
                < LISTENER_CHECK_MINUTE_LIMIT
            )
        )
    )

    if should_check_listeners:
        try:
            (
                listener_updated_count,
                listener_total_count,
            ) = merge_guyso_listeners(
                data
            )

            if listener_updated_count > 0:
                changed = True

                messages.append(
                    "이용자 수 "
                    f"{listener_updated_count}건 반영"
                )

            else:
                messages.append(
                    "가이섬 이용자 수 "
                    "신규 데이터 없음"
                )

            messages.append(
                "가이섬 조회 "
                f"{listener_total_count}일분"
            )

        except Exception as error:
            messages.append(
                "가이섬 이용자 수 조회 실패: "
                f"{error}"
            )

    elif missing_listener_dates:
        messages.append(
            "이용자 수 대기 "
            f"{len(missing_listener_dates)}건"
        )

    else:
        messages.append(
            "이용자 수 저장 완료"
        )

    daily_history.sort(
        key=lambda item:
        item["chartDate"]
    )

    data["dailyHistory"] = (
        daily_history
    )

    return (
        changed,
        " / ".join(messages),
    )


def main() -> None:
    # 1. 멜론 시간별 TOP100 순위 조회
    hourly_html = (
        download_chart_html()
    )

    hourly_rank = find_song_rank(
        hourly_html,
    )

    # 2. GitHub의 최신 chart.json 조회
    file_info = github_api(
        "GET",
        f"{API_URL}?ref={BRANCH}",
    )

    encoded = (
        file_info["content"]
        .replace("\n", "")
    )

    decoded = (
        base64
        .b64decode(encoded)
        .decode("utf-8")
    )

    data = json.loads(decoded)

    # 3. 현재 한국 시간
    now = datetime.now(KST)

    song_info = {
        "songId": SONG_ID,
        "title": SONG_TITLE,
        "artist": ARTIST,
    }

    song_changed = (
        data.get("song")
        != song_info
    )

    data["song"] = song_info

    # 4. 시간별 순위 반영
    (
        hourly_changed,
        charted_at,
    ) = update_hourly_rank(
        data,
        now,
        hourly_rank,
    )

    # 5. 일간 순위 반영
    (
        daily_changed,
        daily_message,
    ) = update_daily_rank(
        data,
        now,
    )

    # 아무 변경도 없으면 GitHub 커밋 생략
    if (
        not song_changed
        and not hourly_changed
        and not daily_changed
    ):
        hourly_text = (
            "차트 아웃"
            if hourly_rank is None
            else f"{hourly_rank}위"
        )

        print(
            f"변경 없음: {charted_at} / "
            f"시간별 {hourly_text}"
        )

        print(
            f"일간: {daily_message}"
        )

        return

    # 6. JSON을 Base64로 변환
    json_text = (
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    new_content = (
        base64
        .b64encode(
            json_text.encode("utf-8")
        )
        .decode("ascii")
    )

    changed_parts = []

    if song_changed:
        changed_parts.append("song")

    if hourly_changed:
        changed_parts.append("hourly")

    if daily_changed:
        changed_parts.append("daily")

    commit_target = ", ".join(
        changed_parts
    )

    # 7. GitHub에 한 번만 커밋
    github_api(
        "PUT",
        API_URL,
        {
            "message": (
                "Update Melon "
                f"{commit_target} "
                "data [Railway]"
            ),
            "content": new_content,
            "sha": file_info["sha"],
            "branch": BRANCH,
        },
    )

    hourly_text = (
        "차트 아웃"
        if hourly_rank is None
        else f"{hourly_rank}위"
    )

    print(
        f"저장 완료: {charted_at} / "
        f"시간별 {hourly_text}"
    )

    print(
        f"일간: {daily_message}"
    )


if __name__ == "__main__":
    main()