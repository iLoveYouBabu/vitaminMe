// 차트이력
const DATA_URL = "./data/chart.json";

// 컴백일자
const COMEBACK_DATE = "2026-07-21";

// 일주일 표기용
const WEEKDAYS = [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토"
];

// 하루 밀리초 기준 왜 쓰는거지?
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

async function loadChart() {
    const content = document.getElementById("content");

    try {
        const response = await fetch(DATA_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `데이터 조회 실패: HTTP ${response.status}`
            );
        }

        const data = await response.json();

        document.getElementById("song-title").textContent =
            data.song.title;

        document.getElementById("artist").textContent =
            data.song.artist;

        renderTable(
            data.history,
            data.dailyHistory ?? []
        );
    } catch (error) {
        console.error(error);

        content.className = "error";
        content.textContent =
            "순위 데이터를 불러오지 못했습니다: " + error.message;
    }
}

function renderTable(history, dailyHistory) {
    const content = document.getElementById("content");

    const grouped = groupByDate(history);
    const dailyByDate = groupDailyByDate(dailyHistory);

    // PC용: 오래된 날짜부터
    const desktopDates = Object.keys(grouped).sort();

    // 모바일용: 최신 날짜부터
    const mobileDates = [...desktopDates].reverse();

    const chartContainer = document.createElement("div");

    chartContainer.appendChild(
        createDesktopChart(
            grouped,
            dailyByDate,
            desktopDates
        )
    );

    chartContainer.appendChild(
        createMobileChart(
            grouped,
            dailyByDate,
            mobileDates
        )
    );

    content.className = "";
    content.innerHTML = "";
    content.appendChild(chartContainer);
}


function createDesktopChart(
    grouped,
    dailyByDate,
    dates
) {
    const wrapper = document.createElement("div");

    wrapper.id = "desktop-chart-view";
    wrapper.className = "table-wrap desktop-chart";

    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    /*
     * 날짜
     */
    const dateHeader = document.createElement("th");
    dateHeader.textContent = "날짜";
    headerRow.appendChild(dateHeader);

    /*
     * 일간 순위
     */
    const dailyHeader = document.createElement("th");
    dailyHeader.className = "daily-header";
    dailyHeader.textContent = "일간";
    headerRow.appendChild(dailyHeader);

    /*
     * 이용자 수
     */
    const listenerHeader = document.createElement("th");
    listenerHeader.className = "listener-header";
    listenerHeader.textContent = "이용자";
    headerRow.appendChild(listenerHeader);

    /*
     * 시간별 순위
     */
    for (let hour = 0; hour < 24; hour++) {
        const th = document.createElement("th");
        th.textContent = hour;
        headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const date of dates) {
        const row = document.createElement("tr");
        const dailyData = dailyByDate[date];

        /*
         * 날짜
         */
        const dateCell = document.createElement("td");
        dateCell.className = "date-cell";
        dateCell.textContent = formatChartDate(date);
        row.appendChild(dateCell);

        /*
         * 일간 순위
         */
        const dailyCell = document.createElement("td");
        dailyCell.className = "daily-rank-cell";

        applyDailyRankStyle(
            dailyCell,
            dailyData?.rank,
            false
        );

        row.appendChild(dailyCell);

        /*
         * 이용자 수
         */
        const listenerCell = document.createElement("td");
        listenerCell.className = "listener-cell";

        applyListenerStyle(
            listenerCell,
            dailyData?.listeners
        );

        row.appendChild(listenerCell);

        /*
         * 시간별 순위
         */
        for (let hour = 0; hour < 24; hour++) {
            const cell = document.createElement("td");
            cell.className = "rank-cell";

            const rank = grouped[date][hour];

            applyRankStyle(cell, rank);

            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
}


function createMobileChart(
    grouped,
    dailyByDate,
    dates
) {
    const mobileChart = document.createElement("div");

    mobileChart.id = "mobile-chart-view";
    mobileChart.className = "mobile-chart";

    for (const date of dates) {
        const card = document.createElement("section");
        card.className = "day-card";

        const dailyData = dailyByDate[date];

        /*
         * 카드 상단
         */
        const title = document.createElement("div");
        title.className = "day-title";

        const titleText = document.createElement("span");
        titleText.className = "day-title-text";
        titleText.textContent = formatChartDate(date);

        /*
         * 일간 정보 버튼
         */
        const dailyButton = document.createElement("button");

        dailyButton.type = "button";
        dailyButton.className = "daily-rank-badge";

        applyDailyRankStyle(
            dailyButton,
            dailyData?.rank,
            true
        );

        dailyButton.setAttribute(
            "aria-label",
            `${formatDate(date)} 일간 정보 보기`
        );

        dailyButton.addEventListener("click", () => {
            openDailyModal(
                date,
                dailyByDate
            );
        });

        title.appendChild(titleText);
        title.appendChild(dailyButton);

        /*
         * 시간별 순위
         */
        const grid = document.createElement("div");
        grid.className = "mobile-hour-grid";

        for (let hour = 0; hour < 24; hour++) {
            const cell = document.createElement("button");

            cell.type = "button";
            cell.className = "mobile-rank-cell";

            cell.setAttribute(
                "aria-label",
                `${formatDate(date)} ${hour}시 순위 비교`
            );

            cell.addEventListener("click", () => {
                openHourModal(
                    hour,
                    grouped,
                    date
                );
            });

            const hourText = document.createElement("div");
            hourText.className = "mobile-hour";
            hourText.textContent = `${hour}시`;

            const rankText = document.createElement("div");
            rankText.className = "mobile-rank";

            const rank = grouped[date][hour];

            applyRankStyle(
                cell,
                rank,
                rankText
            );

            cell.appendChild(hourText);
            cell.appendChild(rankText);
            grid.appendChild(cell);
        }

        card.appendChild(title);
        card.appendChild(grid);
        mobileChart.appendChild(card);
    }

    return mobileChart;
}


function applyRankStyle(cell, rank, textElement = cell) {
    if (rank === undefined) {
        textElement.textContent = "";
        return;
    }

    if (rank === null) {
        textElement.textContent = "-";
        cell.classList.add("out");
        return;
    }

    textElement.textContent = rank;
    cell.classList.add(getRankClass(rank));
}




function applyDailyRankStyle(
    element,
    rank,
    showLabel
) {
    // 아직 일간 순위가 발표되지 않음
    if (rank === undefined) {
        element.textContent = showLabel
            ? "일간 집계 중"
            : "집계 중";

        element.classList.add("pending");
        return;
    }

    // 일간 TOP100 차트 아웃
    if (rank === null) {
        element.textContent = showLabel
            ? "일간 차트 아웃"
            : "아웃";

        element.classList.add("out");
        return;
    }

    // PC 표에서는 숫자만, 모바일에서는 설명 포함
    element.textContent = showLabel
        ? `일간 ${rank}위`
        : `${rank}`;

    element.classList.add("daily-ranked");
}

function applyListenerStyle(
    element,
    listeners
) {
    if (listeners === undefined) {
        element.textContent = "집계 중";
        element.classList.add("pending");
        return;
    }

    element.textContent =
        listeners.toLocaleString("ko-KR");

    element.classList.add("listener-ranked");
}


function groupByDate(history) {
    const grouped = {};

    for (const item of history) {
        const date = item.chartedAt.substring(0, 10);
        const hour = Number(
            item.chartedAt.substring(11, 13)
        );

        if (!grouped[date]) {
            grouped[date] = {};
        }

        grouped[date][hour] = item.rank;
    }

    return grouped;
}


function groupDailyByDate(dailyHistory) {
    const grouped = {};

    for (const item of dailyHistory) {
        grouped[item.chartDate] = {
            rank: item.rank,
            listeners: item.listeners
        };
    }

    return grouped;
}

function formatDate(date) {
    const [year, month, day] = date.split("-");
    return `${year}.${month}.${day}`;
}


function getUtcTime(date) {
    const [year, month, day] =
        date.split("-").map(Number);

    return Date.UTC(
        year,
        month - 1,
        day
    );
}

function getWeekday(date) {
    const utcTime = getUtcTime(date);
    const dateObject = new Date(utcTime);

    return WEEKDAYS[
        dateObject.getUTCDay()
    ];
}

function getComebackDay(date) {
    const targetTime = getUtcTime(date);
    const comebackTime =
        getUtcTime(COMEBACK_DATE);

    const difference =
        Math.floor(
            (targetTime - comebackTime) /
            DAY_IN_MILLISECONDS
        );

    // 컴백 당일을 1일차로 계산
    return difference + 1;
}

function formatChartDate(date) {
    const weekday = getWeekday(date);
    const comebackDay = getComebackDay(date);

    return (
        `${formatDate(date)} (${weekday})` +
        ` - ${comebackDay}일차`
    );
}

function getRankClass(rank) {
    if (rank <= 30) {
        return "rank-high";
    }

    if (rank <= 70) {
        return "rank-middle";
    }

    return "rank-low";
}


/**
 * 모달 오픈
 * @param {*} hour 
 * @param {*} grouped 
 * @param {*} selectedDate 
 */
function openHourModal(hour, grouped, selectedDate) {
    const modal = document.getElementById("hour-modal");
    const title = document.getElementById("hour-modal-title");
    const description = document.getElementById(
        "hour-modal-description"
    );
    const content = document.getElementById(
        "hour-modal-content"
    );

    title.textContent = `${hour}시 순위 기록`;
    description.textContent =
        "같은 시간대의 날짜별 순위입니다.";

    const dates = Object.keys(grouped).sort().reverse();

    /*
     * 선택한 시간대의 기록을 순위가 좋은 순서대로 정렬하고,
     * 최고 기록 3개에 1·2·3을 부여합니다.
     */
    const topRecords = Object.keys(grouped)
        .map(date => ({
            date,
            rank: grouped[date][hour]
        }))
        .filter(record => Number.isInteger(record.rank))
        .sort((a, b) => {
            if (a.rank !== b.rank) {
                return a.rank - b.rank;
            }

            // 같은 순위면 최신 날짜 우선
            return b.date.localeCompare(a.date);
        })
        .slice(0, 3);

    const placeByDate = new Map(
        topRecords.map((record, index) => [
            record.date,
            index + 1
        ])
    );

    const list = document.createElement("div");
    list.className = "hour-rank-list";

    for (const date of dates) {
        const rank = grouped[date][hour];

        const row = document.createElement("div");
        row.className = "hour-rank-row";

        if (date === selectedDate) {
            row.classList.add("selected");
        }

        const dateElement = document.createElement("div");
        dateElement.className = "hour-rank-date";
        dateElement.textContent = formatDateWithWeekday(date);

        const rankElement = document.createElement("div");
        rankElement.className = "hour-rank-value";

        if (rank === undefined) {
            rankElement.textContent = "미수집";
            rankElement.classList.add("no-data");
        } else if (rank === null) {
            rankElement.textContent = "차트 아웃";
            rankElement.classList.add("out");
        } else {
            rankElement.textContent = `${rank}위`;
            rankElement.classList.add(getRankClass(rank));
        }

        const placeElement = document.createElement("div");
        placeElement.className = "hour-rank-place";

        const place = placeByDate.get(date);

        if (place !== undefined) {
            placeElement.textContent = place;
            placeElement.classList.add(`place-${place}`);
        }

        row.appendChild(dateElement);
        row.appendChild(placeElement);
        row.appendChild(rankElement);
        list.appendChild(row);
    }

    content.innerHTML = "";
    content.appendChild(list);

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}


function closeHourModal() {
    const modal = document.getElementById("hour-modal");

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}


function getPreviousDate(date) {
    const previousTime =
        getUtcTime(date) - DAY_IN_MILLISECONDS;

    return new Date(previousTime)
        .toISOString()
        .substring(0, 10);
}

function formatDailyRankValue(rank) {
    if (rank === undefined) {
        return "집계 중";
    }

    if (rank === null) {
        return "차트 아웃";
    }

    return `${rank}위`;
}


function formatListenerValue(listeners) {
    if (listeners === undefined) {
        return "집계 중";
    }

    return `${listeners.toLocaleString("ko-KR")}명`;
}


function compareDailyRank(
    currentRank,
    previousRank
) {
    if (currentRank === undefined) {
        return {
            text: "오늘 일간 순위 집계 중",
            state: "neutral"
        };
    }

    if (previousRank === undefined) {
        return {
            text: "전일 비교 데이터 없음",
            state: "neutral"
        };
    }

    // 이하 기존 코드 그대로

    /*
     * 전일과 오늘 모두 차트 아웃
     */
    if (
        currentRank === null
        && previousRank === null
    ) {
        return {
            text: "전일과 동일 · 차트 아웃",
            state: "neutral"
        };
    }

    /*
     * 전일에는 순위권이었지만
     * 오늘 차트 아웃
     */
    if (
        currentRank === null
        && Number.isInteger(previousRank)
    ) {
        return {
            text:
                `전일 ${previousRank}위에서 차트 아웃`,
            state: "negative"
        };
    }

    /*
     * 전일 차트 아웃에서 오늘 재진입
     */
    if (
        Number.isInteger(currentRank)
        && previousRank === null
    ) {
        return {
            text:
                `전일 차트 아웃에서 ${currentRank}위 재진입`,
            state: "positive"
        };
    }

    if (
        !Number.isInteger(currentRank)
        || !Number.isInteger(previousRank)
    ) {
        return {
            text: "전일 비교 데이터 없음",
            state: "neutral"
        };
    }

    /*
     * 순위는 숫자가 작아질수록 상승
     */
    const movement =
        previousRank - currentRank;

    if (movement > 0) {
        return {
            text:
                `전일 ${previousRank}위보다 ` +
                `${movement}계단 상승`,
            state: "positive"
        };
    }

    if (movement < 0) {
        return {
            text:
                `전일 ${previousRank}위보다 ` +
                `${Math.abs(movement)}계단 하락`,
            state: "negative"
        };
    }

    return {
        text:
            `전일 ${previousRank}위와 동일`,
        state: "neutral"
    };
}


function compareListeners(
    currentListeners,
    previousListeners
) {
    if (currentListeners === undefined) {
        return {
            text: "오늘 이용자 수 집계 중",
            state: "neutral"
        };
    }

    if (previousListeners === undefined) {
        return {
            text: "전일 비교 데이터 없음",
            state: "neutral"
        };
    }

    const difference =
        currentListeners - previousListeners;

    if (difference === 0) {
        return {
            text:
                `전일 ${previousListeners.toLocaleString("ko-KR")}명과 동일`,
            state: "neutral"
        };
    }

    let percentageText = "";

    if (previousListeners > 0) {
        const percentage =
            Math.abs(
                difference
                / previousListeners
                * 100
            ).toFixed(1);

        percentageText =
            difference > 0
                ? ` (+${percentage}%)`
                : ` (-${percentage}%)`;
    }

    if (difference > 0) {
        return {
            text:
                `전일 ${previousListeners.toLocaleString("ko-KR")}명보다 ` +
                `${difference.toLocaleString("ko-KR")}명 증가` +
                percentageText,
            state: "positive"
        };
    }

    return {
        text:
            `전일 ${previousListeners.toLocaleString("ko-KR")}명보다 ` +
            `${Math.abs(difference).toLocaleString("ko-KR")}명 감소` +
            percentageText,
        state: "negative"
    };
}


function createDailyMetricCard(
    label,
    value,
    comparison
) {
    const card = document.createElement("section");
    card.className = "daily-metric-card";

    const labelElement =
        document.createElement("div");

    labelElement.className =
        "daily-metric-label";

    labelElement.textContent = label;

    const valueElement =
        document.createElement("div");

    valueElement.className =
        "daily-metric-value";

    valueElement.textContent = value;

    const comparisonElement =
        document.createElement("div");

    comparisonElement.className =
        `daily-metric-change ${comparison.state}`;

    comparisonElement.textContent =
        comparison.text;

    card.appendChild(labelElement);
    card.appendChild(valueElement);
    card.appendChild(comparisonElement);

    return card;
}


function openDailyModal(
    date,
    dailyByDate
) {
    const modal =
        document.getElementById("daily-modal");

    const title =
        document.getElementById(
            "daily-modal-title"
        );

    const description =
        document.getElementById(
            "daily-modal-description"
        );

    const content =
        document.getElementById(
            "daily-modal-content"
        );

    const currentData =
        dailyByDate[date] ?? {
            rank: undefined,
            listeners: undefined
        };

    const previousDate =
        getPreviousDate(date);

    const previousData =
        dailyByDate[previousDate];

    title.textContent =
        `${formatDateWithWeekday(date)} 일간 정보`;

    description.textContent =
        `${formatDateWithWeekday(previousDate)} 대비`;

    const rankComparison =
        compareDailyRank(
            currentData.rank,
            previousData?.rank
        );

    const listenerComparison =
        compareListeners(
            currentData.listeners,
            previousData?.listeners
        );

    const summary =
        document.createElement("div");

    summary.className = "daily-summary";

    summary.appendChild(
        createDailyMetricCard(
            "일간 순위",
            formatDailyRankValue(
                currentData.rank
            ),
            rankComparison
        )
    );

    summary.appendChild(
        createDailyMetricCard(
            "이용자 수",
            formatListenerValue(
                currentData.listeners
            ),
            listenerComparison
        )
    );

    const source =
        document.createElement("p");

    source.className = "daily-data-source";
    source.textContent =
        "이용자 수 출처: 가이섬";

    content.innerHTML = "";
    content.appendChild(summary);
    content.appendChild(source);

    modal.classList.add("open");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closeDailyModal() {
    const modal =
        document.getElementById("daily-modal");

    modal.classList.remove("open");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}

/**
 * 모달 안에 날자 보여주기.
 * @param {*} date 
 * @returns 
 */
function formatDateWithWeekday(date) {
    return `${formatDate(date)} (${getWeekday(date)})`;
}


document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeHourModal();
        closeDailyModal();
    }
});


const cardViewButton =
    document.getElementById("card-view-button");

const tableViewButton =
    document.getElementById("table-view-button");

function setViewMode(mode) {
    const isTableView = mode === "table";

    document.body.classList.toggle(
        "table-view",
        isTableView
    );

    document.body.classList.toggle(
        "card-view",
        !isTableView
    );

    cardViewButton.classList.toggle(
        "active",
        !isTableView
    );

    tableViewButton.classList.toggle(
        "active",
        isTableView
    );

    localStorage.setItem(
        "chartViewMode",
        mode
    );
}

if (cardViewButton && tableViewButton) {
    cardViewButton.addEventListener("click", () => {
        setViewMode("card");
    });

    tableViewButton.addEventListener("click", () => {
        setViewMode("table");
    });

    const savedViewMode =
        localStorage.getItem("chartViewMode") || "card";

    setViewMode(savedViewMode);
}

loadChart();
