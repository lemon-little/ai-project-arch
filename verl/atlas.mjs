import {
  DEFAULT_DIAGRAM_ID,
  buildDiagramUrl,
  diagrams,
  findDiagram,
  filterDiagrams,
} from "./catalog.mjs";

const frame = document.querySelector('[data-testid="diagram-frame"]');
const list = document.querySelector('[data-testid="diagram-list"]');
const search = document.querySelector('[data-testid="diagram-search"]');
const toast = document.querySelector(".toast");
const readyCount = document.querySelector("[data-ready-count]");
const workspaceIndex = document.querySelector("[data-workspace-index]");
const workspaceTitle = document.querySelector("[data-workspace-title]");
const workspaceType = document.querySelector("[data-workspace-type]");
const workspaceSummary = document.querySelector("[data-workspace-summary]");

const params = new URLSearchParams(window.location.search);
const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const initialTheme = params.get("theme") ?? localStorage.getItem("verl-atlas-theme") ?? preferredTheme;

const state = {
  activeId: findDiagram(params.get("view") ?? DEFAULT_DIAGRAM_ID).id,
  theme: initialTheme === "dark" ? "dark" : "light",
  query: "",
};

let toastTimer;

function syncLocation() {
  const next = new URL(window.location.href);
  next.searchParams.set("view", state.activeId);
  next.searchParams.set("theme", state.theme);
  window.history.replaceState({}, "", next);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.visible = "true";
  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = "false";
  }, 1800);
}

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem("verl-atlas-theme", state.theme);
  document.querySelector('[data-action="theme"]').textContent = state.theme === "dark" ? "☀" : "☾";
  frame.src = buildDiagramUrl(findDiagram(state.activeId), state.theme, { embed: true, inspect: true });
  syncLocation();
}

function selectDiagram(id, { closeNav = true } = {}) {
  const diagram = findDiagram(id);
  state.activeId = diagram.id;
  frame.title = `${diagram.order} ${diagram.title}`;
  frame.src = buildDiagramUrl(diagram, state.theme, { embed: true, inspect: true });
  workspaceIndex.textContent = diagram.order;
  workspaceTitle.textContent = diagram.title;
  workspaceType.textContent = diagram.type;
  workspaceSummary.textContent = diagram.summary;
  document.title = `${diagram.title} | VERL Architecture Atlas`;
  document.querySelectorAll(".diagram-item").forEach((item) => {
    const active = item.dataset.diagramId === diagram.id;
    item.toggleAttribute("aria-current", active);
    if (active) item.setAttribute("aria-current", "page");
  });
  if (closeNav) document.body.dataset.navOpen = "false";
  syncLocation();
}

function diagramButton(diagram) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "diagram-item";
  button.dataset.diagramId = diagram.id;
  button.innerHTML = `
    <span class="diagram-index">${diagram.order}</span>
    <span class="diagram-copy">
      <span class="diagram-title">${diagram.title}</span>
      <span class="diagram-summary">${diagram.summary}</span>
    </span>
    <span class="diagram-status" aria-label="已就绪" title="已就绪"></span>
  `;
  button.addEventListener("click", () => selectDiagram(diagram.id));
  return button;
}

function renderList() {
  const matches = filterDiagrams(state.query);
  list.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "没有匹配的图示";
    list.append(empty);
    return;
  }
  matches.forEach((diagram) => list.append(diagramButton(diagram)));
  selectDiagram(state.activeId, { closeNav: false });
}

async function copyShareLink() {
  syncLocation();
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("当前视图链接已复制");
  } catch {
    showToast("无法访问剪贴板，请复制地址栏链接");
  }
}

function openDiagram() {
  window.open(buildDiagramUrl(findDiagram(state.activeId), state.theme), "_blank", "noopener,noreferrer");
}

function exportDiagram() {
  const diagram = findDiagram(state.activeId);
  const anchor = document.createElement("a");
  anchor.href = diagram.href;
  anchor.download = `verl-${diagram.id}.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  showToast("已开始下载当前图");
}

document.querySelector('[data-action="theme"]').addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark");
});
document.querySelector('[data-action="share"]').addEventListener("click", copyShareLink);
document.querySelector('[data-action="open"]').addEventListener("click", openDiagram);
document.querySelector('[data-action="export"]').addEventListener("click", exportDiagram);
document.querySelector('[data-action="toggle-nav"]').addEventListener("click", () => {
  document.body.dataset.navOpen = document.body.dataset.navOpen !== "true" ? "true" : "false";
});
document.querySelector('[data-action="close-nav"]').addEventListener("click", () => {
  document.body.dataset.navOpen = "false";
});

search.addEventListener("input", () => {
  state.query = search.value;
  renderList();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
    event.preventDefault();
    document.body.dataset.navOpen = "true";
    search.focus();
  }
  if (event.key === "Escape") {
    document.body.dataset.navOpen = "false";
    search.blur();
  }
});

readyCount.textContent = String(diagrams.filter(({ status }) => status === "ready").length);
document.documentElement.dataset.theme = state.theme;
renderList();
setTheme(state.theme);
