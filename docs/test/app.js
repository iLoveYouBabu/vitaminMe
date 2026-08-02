const DATA_URL = "../data/chart.json";

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

        renderTable(data.history);
    } catch (error) {
        console.error(error);

        content.className = "error";
        content.textContent =
            "순위 데이터를 불러오지 못했습니다: " + error.message;
    }
}

function renderTable(history) {
    const content = document.getElementById("content");

    const grouped = groupByDate(history);

    // PC용: 오래된 날짜부터
    const desktopDates = Object.keys(grouped).sort();
    
    // 모바일용: 최신 날짜부터
    const mobileDates = [...desktopDates].reverse();
    
    const chartContainer = document.createElement("div");
    
    chartContainer.appendChild(
        createDesktopChart(grouped, desktopDates)
    );
    
    chartContainer.appendChild(
        createMobileChart(grouped, mobileDates)
    );

    content.className = "";
    content.innerHTML = "";
    content.appendChild(chartContainer);
}


function createDesktopChart(grouped, dates) {
    const wrapper = document.createElement("div");

    wrapper.id = "desktop-chart-view";
    wrapper.className = "table-wrap desktop-chart";

    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const dateHeader = document.createElement("th");
    dateHeader.textContent = "날짜";
    headerRow.appendChild(dateHeader);

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

        const dateCell = document.createElement("td");
        dateCell.className = "date-cell";
        dateCell.textContent = formatDate(date);
        row.appendChild(dateCell);

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


function createMobileChart(grouped, dates) {
    const mobileChart = document.createElement("div");

    mobileChart.id = "mobile-chart-view";
    mobileChart.className = "mobile-chart";

    for (const date of dates) {
        const card = document.createElement("section");
        card.className = "day-card";

        const title = document.createElement("div");
        title.className = "day-title";
        title.textContent = formatDate(date);

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
                openHourModal(hour, grouped, date);
            });

            const hourText = document.createElement("div");
            hourText.className = "mobile-hour";
            hourText.textContent = `${hour}시`;

            const rankText = document.createElement("div");
            rankText.className = "mobile-rank";

            const rank = grouped[date][hour];

            applyRankStyle(cell, rank, rankText);

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

function formatDate(date) {
    const [year, month, day] = date.split("-");
    return `${year}.${month}.${day}`;
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
        dateElement.textContent = formatDate(date);

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


document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeHourModal();
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
