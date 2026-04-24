const API_BASE = "";

// ========== State ==========
let currentPage = "apps";
let installedApps = [];
let storeApps = [];
let currentApp = null;
let currentSession = null;
let allSessions = [];
let formFrozen = false;

// ========== API Calls ==========
async function api(path, opts) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

async function loadInstalledApps() {
  installedApps = await api("/api/apps/installed");
  renderInstalledApps();
}

async function loadStoreApps() {
  const sort = document.getElementById("store-sort").value;
  storeApps = await api(`/api/hub/apps?sort=${sort}`);
  renderStoreApps();
}

async function createSessionForApp(appName) {
  const session = await api("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appName }),
  });
  openSession(session);
}

async function openSession(session) {
  currentSession = session;
  formFrozen = false;
  renderSessionView();
}

async function executeCurrentSession() {
  if (!currentSession) return;
  const result = await api(`/api/sessions/${currentSession.id}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  currentSession.status = result.success ? "completed" : "error";
  currentSession.result = result.output;
  renderSessionView();
}

async function sendChatMessage() {
  if (!currentSession) return;
  const input = document.getElementById("chat-input");
  const content = input.value.trim();
  if (!content) return;

  await api(`/api/sessions/${currentSession.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content }),
  });
  input.value = "";

  // Reload session
  currentSession = await api(`/api/sessions/${currentSession.id}`);
  renderSessionView();
}

// ========== Render ==========
function renderInstalledApps() {
  const container = document.getElementById("installed-apps");
  if (installedApps.length === 0) {
    container.innerHTML = '<p class="text-secondary">尚未安装任何 app，前往 App 仓库安装</p>';
    return;
  }
  container.innerHTML = installedApps.map((app) => `
    <div class="app-card" onclick="openApp('${app}')">
      <div class="app-card-title">${app}</div>
    </div>
  `).join("");
}

function renderStoreApps() {
  const container = document.getElementById("store-list");
  const search = document.getElementById("store-search").value.toLowerCase();
  const filtered = storeApps.filter((a) => a.name.toLowerCase().includes(search));

  container.innerHTML = filtered.map((app) => `
    <div class="store-item">
      <div class="store-item-info">
        <h3>${app.name}</h3>
        <p>v${app.version} · ${app.author} · ${app.downloads} 下载</p>
      </div>
      <button class="btn ${app.installed ? 'btn-secondary' : 'btn-primary'} btn-small"
              onclick="installApp('${app.fileName}')"
              ${app.installed ? "disabled" : ""}>
        ${app.installed ? "已安装" : "安装"}
      </button>
    </div>
  `).join("");
}

function openApp(appName) {
  currentApp = appName;
  loadAppSessions();
}

async function loadAppSessions() {
  allSessions = await api(`/api/sessions/app/${currentApp}`);
  renderSessionsList();
}

function renderSessionsList() {
  const panel = document.getElementById("sessions-panel");
  panel.classList.remove("hidden");

  let html = `
    <div class="flex items-center gap-4" style="margin-bottom: var(--spacing-4);">
      <h2>${currentApp}</h2>
      <button class="btn btn-primary btn-small" onclick="createSessionForApp('${currentApp}')">新建会话</button>
      <button class="btn btn-secondary btn-small" onclick="closeSessionsPanel()">返回</button>
    </div>
    <div class="session-list">
  `;

  if (allSessions.length === 0) {
    html += '<p class="text-secondary">暂无会话</p>';
  } else {
    html += allSessions.map((s) => `
      <div class="session-item ${currentSession?.id === s.id ? 'active' : ''}" onclick="openSessionById('${s.id}')">
        <span class="text-sm">${new Date(s.createdAt).toLocaleString()}</span>
        <span class="session-status ${s.status}">${statusLabel(s.status)}</span>
      </div>
    `).join("");
  }

  html += "</div>";
  panel.innerHTML = html;
}

function openSessionById(id) {
  const session = allSessions.find((s) => s.id === id);
  if (session) {
    openSession(session);
  }
}

function renderSessionView() {
  const panel = document.getElementById("sessions-panel");
  const isRunning = currentSession.status === "running";
  const isCompleted = currentSession.status === "completed";

  panel.innerHTML = `
    <div class="session-view">
      <div class="session-header">
        <h3>${currentApp} - 会话</h3>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-small" id="execute-btn" onclick="executeCurrentSession()"
                  ${isRunning || isCompleted || formFrozen ? "disabled" : ""}>
            ${isRunning ? "执行中..." : isCompleted ? "已完成" : "执行"}
          </button>
          <button class="btn btn-secondary btn-small" onclick="closeSessionView()">关闭</button>
        </div>
      </div>

      <!-- Form Section -->
      <div class="form-section">
        <h4>输入参数</h4>
        <div id="form-fields">
          <p class="text-sm text-secondary">该 app 没有定义表单字段</p>
        </div>
      </div>

      <!-- Chat Section -->
      <div class="chat-section">
        <h4>补充说明</h4>
        <div class="chat-messages" id="chat-messages">
          ${renderChatMessages()}
        </div>
        <div class="chat-input-row">
          <textarea id="chat-input" class="textarea" placeholder="输入补充说明..."></textarea>
          <button class="btn btn-primary" onclick="sendChatMessage()">发送</button>
        </div>
      </div>

      <!-- Result Section -->
      ${isCompleted || currentSession.result ? `
        <div class="result-section">
          <h4>执行结果</h4>
          <div class="result-content">${currentSession.result || "无结果"}</div>
        </div>
      ` : ""}
    </div>
  `;

  // Scroll chat to bottom
  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatMessages() {
  if (!currentSession || currentSession.chatMessages.length === 0) {
    return '<p class="text-sm text-secondary">暂无补充说明</p>';
  }
  return currentSession.chatMessages.map((msg) => `
    <div class="chat-msg">
      <div class="chat-msg-user">${msg.role === "user" ? "你" : "系统"}</div>
      <div class="chat-msg-content">${msg.content}</div>
    </div>
  `).join("");
}

function statusLabel(status) {
  const labels = { idle: "等待中", running: "执行中", completed: "已完成", error: "出错" };
  return labels[status] || status;
}

function closeSessionsPanel() {
  document.getElementById("sessions-panel").classList.add("hidden");
  currentApp = null;
  currentSession = null;
  loadInstalledApps();
}

function closeSessionView() {
  currentSession = null;
  formFrozen = false;
  loadAppSessions();
}

async function installApp(fileName) {
  try {
    await api("/api/apps/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });
    alert("安装成功");
    loadStoreApps();
    loadInstalledApps();
  } catch (err) {
    alert("安装失败: " + err.message);
  }
}

// ========== Navigation ==========
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    const page = tab.dataset.page;
    document.getElementById(`page-${page}`).classList.add("active");
    currentPage = page;

    if (page === "apps") loadInstalledApps();
    if (page === "store") loadStoreApps();
  });
});

document.getElementById("store-search").addEventListener("input", renderStoreApps);
document.getElementById("store-sort").addEventListener("change", loadStoreApps);

// ========== Init ==========
loadInstalledApps();
