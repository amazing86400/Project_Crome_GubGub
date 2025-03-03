let isProgress = false;
let isLock = false;
let cleanedSortObj = {};
let propertyFilter;
let eventFilter;
let highLightValue = [];
let data = [];
let eventIdx = 1;

chrome.devtools.panels.create("GubGub", "", "devtools.html", function (panel) {
  console.log("GubGub DevTools 패널이 생성됨");
});

const port = chrome.runtime.connect({ name: "devtools" });

port.onDisconnect.addListener(() => {
  console.log("DevTools 패널이 닫혔으므로 메시지 전송을 중단합니다.");
});

chrome.runtime.onMessage.addListener((message) => {
  if ((message.action !== "gtm_containers" && message.action !== "ga4_event" && message.action !== "navigation") || message.tabId !== chrome.devtools.inspectedWindow.tabId) return;

  if (message.action === "ga4_event") {
    const event = message.data;
    data.push(event);
    createRequestList(event);
  } else if (message.action === "gtm_containers") {
    checkGTM(message.data);
  } else if (message.action === "navigation") {
    createLodingUrl(message.data);
  }
});

function createLodingUrl(data) {
  eventIdx = 1;

  const url = data;
  const ga4Container = document.getElementById("ga4-data-container");

  const requestEntry = document.createElement("div");
  requestEntry.classList.add("ga4-page-url");
  requestEntry.innerHTML = `
      <div>${url}</div>
    `;

  ga4Container.appendChild(requestEntry);
}

function createRequestList(data) {
  const event = data;
  const ga4Container = document.getElementById("ga4-data-container");
  const date = new Date().toLocaleString();

  if ((!propertyFilter || propertyFilter == event.tid) && (!eventFilter || eventFilter == event.en)) {
    event.ep = sortParams(event.ep, cleanedSortObj.eventParam);
    event.epn = sortParams(event.epn, cleanedSortObj.metricParam);
    event.eco = sortParams(event.eco, cleanedSortObj.ecommerceParam);
    event.up = sortParams(event.up, cleanedSortObj.userParam);

    Object.entries(event).forEach(([key, value]) => {
      if (key.includes("pr")) {
        event[key] = sortParams(value, cleanedSortObj.itemParam);
      }
    });

    const requestEntry = document.createElement("div");
    requestEntry.classList.add("ga4-request");

    requestEntry.innerHTML = `
      <div class="ga4-request-row">
        <span class="ga4-event-index">${eventIdx}</span>
        <span class="ga4-event-name">
          <div event-name="${event.en}">${event.en}</div>
        </span>
        <span class="ga4-property-id">${event.tid}</span>
        <span class="ga4-event-time">${date}</span>
        <div class="copy-btn-container">
          <img src="./images/copy.png" class="copy-btn" alt="Copy All" title="Copy all" />
        </div>
      </div>
    `;

    eventIdx++;

    const copyButton = requestEntry.querySelector(".copy-btn");

    copyButton.addEventListener("click", (e) => {
      console.log(e);
      e.stopPropagation();
      copyToClipboard(e.target);
    });

    const details = document.createElement("div");
    details.classList.add("ga4-details");

    const basicInfo = [
      { key: "GA4 Property ID", value: event.tid },
      { key: "Timestamp", value: event._p },
      { key: "Client ID", value: event.cid },
      { key: "Session ID", value: event.sid },
      { key: "Page URL", value: event.dl },
      { key: "Referrer", value: event.dr },
      { key: "Page Title", value: event.dt },
      { key: "Event Name", value: event.en },
    ];
    const basicInfoSection = createSublist("General", basicInfo);
    if (basicInfoSection) details.appendChild(basicInfoSection);

    const dataSections = [
      { title: "User Property", data: event.up },
      { title: "Custom Dimension", data: event.ep },
      { title: "Custom Metric", data: event.epn },
      { title: "Transaction", data: event.eco },
    ];

    dataSections.forEach(({ title, data }) => {
      if (Array.isArray(data) && data.length > 0) {
        const section = createSublist(title, data);
        if (section) details.appendChild(section);
      }
    });

    if (event["pr1"]) {
      const productInfoSection = createSublist("Items", event, appendProductData);
      if (productInfoSection) details.appendChild(productInfoSection);
    }

    requestEntry.appendChild(details);
    ga4Container.appendChild(requestEntry);

    requestEntry.addEventListener("click", (e) => {
      if (!e.target.closest(".ga4-sublist-title")) {
        requestEntry.classList.toggle("expanded");
      }
    });
    // createRequestList(event);
  }
}

function sortParams(paramArray, sortKeys = [], prefix = "") {
  const sortedParams = sortKeys.map((key) => {
    const fullKey = `${prefix}${key}`;
    const found = paramArray.find((item) => item.key === fullKey);

    return found ? { key: found.key, value: found.value } : { key: fullKey, value: undefined };
  });

  const remainingParams = paramArray.filter((item) => !sortKeys.includes(item.key.replace(prefix, "")));

  return [...sortedParams, ...remainingParams];
}

function copyToClipboard(element) {
  const parentsEle = element.closest(".ga4-request");
  const tables = ["general", "custom-dimension", "custom-metric", "transaction", "item"];
  const formattedText = tables
    .flatMap((tableId) => {
      const table = parentsEle.querySelectorAll("." + tableId);
      return Array.from(table)
        .filter((tbody) => tbody.children.length > 0)
        .map((tbody) => formatTable(tbody));
    })
    .join("\n\n");

  console.log(formattedText);
  if (formattedText == "") {
    alert("복사할 데이터가 없습니다.");
    return false;
  }
  copyTextToClipboard(formattedText);
}

function formatTable(table) {
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .filter((_, index) => index !== 2)
        .map((cell) => cell.textContent)
        .join("\t")
    )
    .join("\n");
}

function copyTextToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function createTable(data, title) {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const table = document.createElement("table");
  table.classList.add("ga4-table");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Key</th>
      <th>Value</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");
  tbody.className = title.replace(/\s+/g, "-").toLowerCase();

  data.forEach(({ key, value }) => {
    if (value) {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${key}</td><td>${value}</td>`;

      if (highLightValue.includes(key)) {
        row.classList.add("highlight");
      }
      tbody.appendChild(row);
    }
  });
  if (tbody.childElementCount == 0) {
    return;
  }
  table.appendChild(thead);
  table.appendChild(tbody);

  table.addEventListener("click", (e) => e.stopPropagation());

  return table;
}

function createSublist(title, data, formatter) {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const sublist = document.createElement("div");
  sublist.classList.add("ga4-sublist", "expanded", `category-${title.replace(/\s+/g, "-").toLowerCase()}`);

  sublist.innerHTML = `
  <div class="ga4-sublist-title">
    <span>${title}</span>
  </div>
  <div class="ga4-sublist-content"></div>
`;

  const sublistContent = sublist.querySelector(".ga4-sublist-content");

  if (formatter) {
    formatter(sublistContent, data);
  } else {
    const table = createTable(data, title);
    if (table) {
      sublistContent.appendChild(table);
    } else {
      return;
    }
  }

  sublist.querySelector(".ga4-sublist-title").addEventListener("click", (e) => {
    e.stopPropagation();
    sublist.classList.toggle("expanded");
  });

  return sublist;
}

function appendProductData(container, event) {
  const productKeys = Object.keys(event)
    .filter((key) => key.startsWith("pr"))
    .sort();

  if (!productKeys.length) return;

  productKeys.forEach((key, index) => {
    const productData = event[key];
    if (!productData || !Array.isArray(productData) || productData.length === 0) return;

    const productEntry = document.createElement("div");
    productEntry.classList.add("ga4-sublist", "expanded");

    const productTitle = document.createElement("div");
    productTitle.classList.add("ga4-sublist-title");
    productTitle.textContent = `item ${index + 1}`;
    productEntry.appendChild(productTitle);

    const productContent = document.createElement("div");
    productContent.classList.add("ga4-sublist-content");

    const table = createTable(productData, "item");
    if (table) productContent.appendChild(table);

    productEntry.appendChild(productContent);
    container.appendChild(productEntry);

    productTitle.addEventListener("click", (e) => {
      e.stopPropagation();
      productEntry.classList.toggle("expanded");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    playButton: document.getElementById("play-btn"),
    playIcon: document.getElementById("play-icon"),

    lockButton: document.getElementById("lock-btn"),
    lockIcon: document.getElementById("lock-icon"),

    clearButton: document.getElementById("clear-btn"),

    filterButton: document.getElementById("filter-btn"),
    filterModalBackground: document.querySelector("#filter-modal > .modal-background"),
    filterModalClose: document.querySelector("#filter-modal > div.modal-area > div > div.modal-close"),
    filterReset: document.getElementById("filter-reset"),
    filterSave: document.getElementById("filter-save"),

    sortButton: document.getElementById("sort-btn"),
    sortModalBackground: document.querySelector("#sort-modal > .modal-background"),
    sortModalClose: document.querySelector("#sort-modal > div.modal-area > div > div.modal-close"),
    sortReset: document.getElementById("sort-reset"),
    sortSave: document.getElementById("sort-save"),

    gtmButton: document.getElementById("gtm-btn"),
    gtmModalBackground: document.querySelector("#gtm-modal > .modal-background"),
    gtmModalClose: document.querySelector("#gtm-modal > div.modal-area > div > div.modal-close"),
    gtmOk: document.getElementById("gtm-check"),

    highLight: document.getElementById("highlight_parameter"),
    highLightList: document.querySelector(".highLight-list"),

    ga4Container: document.getElementById("ga4-data-container"),

    tooltip: document.getElementById("tooltip"),
  };

  elements.playButton.addEventListener("click", () => togglePlay(elements));
  elements.lockButton.addEventListener("click", () => toggleLock(elements));
  elements.clearButton.addEventListener("click", () => clearGA4Data(elements.ga4Container));

  elements.sortButton.addEventListener("click", () => toggleModal("sort-modal", true));
  elements.sortModalBackground.addEventListener("click", (e) => e.target === elements.sortModalBackground && toggleModal("sort-modal", false));
  elements.sortModalClose.addEventListener("click", () => toggleModal("sort-modal", false));
  elements.sortReset.addEventListener("click", () => resetOptions("sort"));
  elements.sortSave.addEventListener("click", saveSortOrder);

  elements.filterButton.addEventListener("click", () => toggleModal("filter-modal", true));
  elements.filterModalBackground.addEventListener("click", (e) => e.target === elements.filterModalBackground && toggleModal("filter-modal", false));
  elements.filterModalClose.addEventListener("click", () => toggleModal("filter-modal", false));
  elements.filterReset.addEventListener("click", () => resetOptions("filter"));
  elements.filterSave.addEventListener("click", saveFilterOrder);
  // elements.gtmButton.addEventListener("click", () => searchGTM());

  elements.gtmButton.addEventListener("click", () => chrome.runtime.sendMessage({ action: "gtm" }));
  elements.gtmModalBackground.addEventListener("click", (e) => e.target === elements.gtmModalBackground && toggleModal("gtm-modal", false));
  elements.gtmModalClose.addEventListener("click", () => toggleModal("gtm-modal", false));
  elements.gtmOk.addEventListener("click", (e) => e.target === elements.gtmOk && toggleModal("gtm-modal", false));

  addTooltipListeners(elements);

  elements.highLight.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && elements.highLight.value.trim() !== "") {
      if (!highLightValue.includes(elements.highLight.value)) {
        highLightValue.push(elements.highLight.value);
        const newItem = document.createElement("p");
        newItem.textContent = elements.highLight.value;
        elements.highLightList.appendChild(newItem);
      }
      elements.highLight.value = "";
    }
  });
});

function togglePlay({ playButton, playIcon, lockButton }) {
  if (isLock) return;

  isProgress = !isProgress;
  const state = isProgress ? "progress" : "play";

  playButton.classList.toggle("progress", isProgress);
  playIcon.src = `./images/${state}.png`;
  playIcon.alt = state;
  playButton.setAttribute("data-tooltip", isProgress ? "Stop automated GA4 validation" : "Run automated GA4 validation");

  lockButton.style.pointerEvents = isProgress ? "none" : "auto";
  lockButton.classList.toggle("disabled", isProgress);
}

function toggleLock({ lockButton, lockIcon, playButton }) {
  if (isProgress) return;

  isLock = !isLock;
  const state = isLock ? "lock" : "open";

  lockButton.classList.toggle("lock", isLock);
  lockIcon.src = `./images/${state}.png`;
  lockIcon.alt = state;
  lockButton.setAttribute("data-tooltip", isLock ? "Allow page navigation" : "Prevent page navigation");

  playButton.style.pointerEvents = isLock ? "none" : "auto";
  playButton.classList.toggle("disabled", isLock);

  chrome.runtime.sendMessage({ action: isLock ? "lock" : "open" });
}

function clearGA4Data(container) {
  data = [];
  eventIdx = 1;
  container.innerHTML = "";
}

function toggleModal(element, open) {
  document.querySelectorAll(".modal-background").forEach((modal) => {
    modal.style.display = "none";
    modal.nextElementSibling.classList.add("remove");
  });

  if (open) {
    const idName = document.getElementById(element);
    const modalArea = idName.querySelector(".modal-area");
    const modalBackground = idName.querySelector(".modal-background");

    modalBackground.style.display = "block";
    modalArea.classList.remove("remove");
  }
}

function resetOptions(type) {
  if (type === "sort") {
    cleanedSortObj = {};
    document.querySelectorAll("textarea[data-event-type]").forEach((textarea) => {
      textarea.value = "";
    });
  }
}

function saveSortOrder() {
  const eventParams = document.querySelector('textarea[data-event-type="event"]').value.split("\n");
  const userParams = document.querySelector('textarea[data-event-type="user"]').value.split("\n");
  const metricParams = document.querySelector('textarea[data-event-type="metric"]').value.split("\n");
  const ecommerceParams = document.querySelector('textarea[data-event-type="ecommerce"]').value.split("\n");
  const itemParams = document.querySelector('textarea[data-event-type="item"]').value.split("\n");

  const cleanArray = (arr) => [...new Set(arr.filter(Boolean))];

  cleanedSortObj = {
    eventParam: cleanArray(eventParams),
    metricParam: cleanArray(metricParams),
    userParam: cleanArray(userParams),
    ecommerceParam: cleanArray(ecommerceParams),
    itemParam: cleanArray(itemParams),
  };

  const container = document.getElementById("ga4-data-container");
  container.innerHTML = "";
  data.forEach((value) => {
    createRequestList(value);
  });
  console.log("정렬 옵션 저장 완료", cleanedSortObj);
  toggleModal("sort-modal", false);
}

function saveFilterOrder() {
  const filterAccount = document.getElementById("filter-account").value;
  const filterEvent = document.getElementById("filter-event").value;
  const container = document.getElementById("ga4-data-container");
  propertyFilter = filterAccount;
  eventFilter = filterEvent;
  container.innerHTML = "";

  data.forEach((value) => {
    createRequestList(value);
  });

  toggleModal("filter-modal", false);
  console.log("saveFilterOrder:");
  console.log(data);
}

function addTooltipListeners(elements) {
  document.body.addEventListener("mouseover", (e) => {
    const button = e.target.closest("button[data-tooltip]");
    if (button) {
      elements.tooltip.textContent = button.getAttribute("data-tooltip");
      elements.tooltip.style.display = "block";
      if (button.id === "gtm-btn") {
        elements.tooltip.style.left = `${button.offsetLeft - elements.tooltip.offsetWidth - 5}px`;
        elements.tooltip.style.top = `${button.offsetTop + button.offsetHeight / 2 - elements.tooltip.offsetHeight / 2}px`;
      } else {
        elements.tooltip.style.left = `${e.pageX + 10}px`;
        elements.tooltip.style.top = `${e.pageY + 10}px`;
      }
    }
  });

  document.body.addEventListener("mouseout", () => {
    elements.tooltip.style.display = "none";
  });
}

function checkGTM(ids) {
  // chrome.runtime.sendMessage({ action: "gtm" });

  const containerListElement = document.getElementById("gtm-container-list");

  if (containerListElement) {
    containerListElement.innerHTML = "";

    ids.forEach((gtmID) => {
      const idElement = document.createElement("div");
      idElement.textContent = gtmID;
      containerListElement.appendChild(idElement);
    });
  }

  toggleModal("gtm-modal", true);
}
