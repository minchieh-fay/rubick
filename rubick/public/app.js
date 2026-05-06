const API_BASE = "";

// ========== State ==========
let currentPage = "apps";
let installedApps = [];
let storeApps = [];
let currentApp = null;
let currentSession = null;
let appManifest = null;
let formFrozen = false;
let streamOutput = "";
let inlineError = null; // { message, timer }

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
  installedApps = await api("/api/apps");
  renderInstalledApps();
}

async function loadStoreApps() {
  const sort = document.getElementById("store-sort")?.value || "usageCount";
  storeApps = await api(`/api/hub/apps?sort=${sort}`);
  renderStoreApps();
}

async function loadAppManifest(appName) {
  try {
    appManifest = await api(`/api/apps/${appName}/manifest`);
  } catch {
    appManifest = null;
  }
}

async function createSessionForApp(appName) {
  await loadAppManifest(appName);
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
  streamOutput = "";
  await loadAppManifest(session.appName);
  renderSessionView();
}

async function executeCurrentSession() {
  if (!currentSession || formFrozen) return;

  const formData = collectFormData();
  currentSession.formData = formData;
  formFrozen = true;

  await api(`/api/sessions/${currentSession.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData }),
  });

  streamOutput = "";
  renderSessionView();
  executeWithFetch();
}

async function executeWithFetch() {
  if (!currentSession) return;

  try {
    const res = await fetch(`/api/sessions/${currentSession.id}/execute-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "chunk") {
            streamOutput += data.content;
            updateResultContent();
          } else if (data.type === "done") {
            currentSession.status = data.success ? "completed" : "error";
            currentSession.result = data.output;
            streamOutput = data.output;
            renderSessionView();
          } else if (data.type === "error") {
            currentSession.status = "error";
            currentSession.errorMessage = data.error;
            renderSessionView();
          }
        }
      }
    }
  } catch (err) {
    currentSession.status = "error";
    currentSession.errorMessage = err.message;
    renderSessionView();
  }
}

function updateResultContent() {
  const el = document.getElementById("result-content");
  if (!el) return;
  // Replace loading spinner with actual output
  const loadingContainer = el.querySelector(".loading-container");
  if (loadingContainer) loadingContainer.remove();
  el.textContent = streamOutput;
  el.scrollTop = el.scrollHeight;
}

async function sendChatMessage() {
  if (!currentSession) return;
  const input = document.getElementById("chat-input");
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  await api(`/api/sessions/${currentSession.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content }),
  });
  input.value = "";

  currentSession = await api(`/api/sessions/${currentSession.id}`);
  renderSessionView();
}

// ========== Form Data Collection ==========
function collectFormData() {
  if (!appManifest?.fields) return {};
  const data = {};
  for (const field of appManifest.fields) {
    const el = document.getElementById(`field-${field.key}`);
    if (el) {
      data[field.key] = el.value;
    }
  }
  return data;
}

function renderFormFields() {
  if (!appManifest?.fields || appManifest.fields.length === 0) {
    return '<p class="text-sm text-secondary">该 app 没有定义表单字段</p>';
  }

  return appManifest.fields.map((field) => {
    const disabled = formFrozen ? "disabled" : "";
    const required = field.required ? "required" : "";
    const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : "";

    let inputHtml = "";
    if (field.type === "textarea") {
      inputHtml = `<textarea id="field-${field.key}" class="textarea" ${disabled} ${required} ${placeholder}></textarea>`;
    } else if (field.type === "select") {
      const options = (field.options || []).map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
      inputHtml = `<select id="field-${field.key}" class="select" ${disabled} ${required}><option value="">请选择</option>${options}</select>`;
    } else {
      inputHtml = `<input type="${field.type}" id="field-${field.key}" class="input" ${disabled} ${required} ${placeholder}>`;
    }

    return `
      <div class="form-field">
        <label for="field-${field.key}">${field.label}${field.required ? " *" : ""}</label>
        ${inputHtml}
      </div>
    `;
  }).join("");
}

// ========== Render ==========
function renderInstalledApps() {
  const container = document.getElementById("installed-apps");
  if (!container) return;

  if (installedApps.length === 0) {
    container.innerHTML = '<p class="text-secondary">尚未安装任何 app，前往 App 仓库安装</p>';
    return;
  }
  container.innerHTML = installedApps.map((app) => `
    <div class="app-card">
      <div class="app-card-content" onclick="openApp('${app.name}')" style="flex:1;cursor:pointer;">
        <div class="app-card-title">${app.name}</div>
        <div class="app-card-version">v${app.version}</div>
      </div>
      <button class="btn btn-secondary btn-small" onclick="showAppDetail('${app.name}')" title="详情">详情</button>
      <button class="btn btn-secondary btn-small" onclick="uninstallApp('${app.name}')" title="卸载">卸载</button>
    </div>
  `).join("");
}

function renderStoreApps() {
  const container = document.getElementById("store-list");
  if (!container) return;

  const searchEl = document.getElementById("store-search");
  const search = searchEl ? searchEl.value.toLowerCase() : "";
  const filtered = storeApps.filter((a) => a.name.toLowerCase().includes(search));

  container.innerHTML = filtered.map((app) => `
    <div class="store-item">
      <div class="store-item-info">
        <h3>${app.name}</h3>
        <p>v${app.version} &middot; ${app.author} &middot; ${app.downloads} 下载</p>
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
  if (!currentApp) return;
  const sessions = await api(`/api/sessions/app/${currentApp}`);
  renderSessionsList(sessions);
}

function renderSessionsList(sessions) {
  const panel = document.getElementById("sessions-panel");
  if (!panel) return;
  panel.classList.remove("hidden");

  let html = `
    <div class="flex items-center gap-4" style="margin-bottom: var(--spacing-4);">
      <h2>${escapeHtml(currentApp)}</h2>
      <button class="btn btn-primary btn-small" onclick="createSessionForApp('${currentApp}')">新建会话</button>
      <button class="btn btn-secondary btn-small" onclick="closeSessionsPanel()">返回</button>
    </div>
    <div class="session-list">
  `;

  if (!sessions || sessions.length === 0) {
    html += '<p class="text-secondary">暂无会话</p>';
  } else {
    html += sessions.map((s) => `
      <div class="session-item ${currentSession?.id === s.id ? 'active' : ''}" onclick="openSessionById('${s.id}')">
        <span class="text-sm">${new Date(s.createdAt).toLocaleString()}</span>
        <span class="session-status ${s.status}">${statusLabel(s.status)}</span>
      </div>
    `).join("");
  }

  html += "</div>";
  panel.innerHTML = html;
}

async function openSessionById(id) {
  try {
    const session = await api(`/api/sessions/${id}`);
    if (session) {
      openSession(session);
    }
  } catch {
    // session not found or API error
  }
}

function renderSessionView() {
  if (!currentSession) return;

  const panel = document.getElementById("sessions-panel");
  if (!panel) return;

  const isRunning = currentSession.status === "running";
  const isCompleted = currentSession.status === "completed";
  const isError = currentSession.status === "error";
  const hasResult = currentSession.result || streamOutput;

  panel.innerHTML = `
    <div class="session-view">
      <div class="session-header">
        <h3>${escapeHtml(currentApp)} - 会话</h3>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-small" onclick="executeCurrentSession()"
                  ${isRunning || isCompleted || isError || formFrozen ? "disabled" : ""}>
            ${isRunning ? "执行中..." : isCompleted ? "已完成" : isError ? "出错" : "执行"}
          </button>
          <button class="btn btn-secondary btn-small" onclick="closeSessionView()">关闭</button>
        </div>
      </div>

      <!-- Form Section -->
      <div class="form-section">
        <h4>输入参数${formFrozen ? " (已冻结)" : ""}</h4>
        <div id="form-fields">
          ${renderFormFields()}
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
      ${isRunning ? `
        <div class="result-section">
          <h4>执行输出...</h4>
          <div class="result-content" id="result-content">
            <div class="loading-container">
              <div class="loading-spinner"></div>
              <div class="loading-text">正在执行中，请稍候...</div>
            </div>
          </div>
        </div>
      ` : hasResult ? `
        <div class="result-section">
          <h4>执行结果</h4>
          <div class="result-content" id="result-content">${escapeHtml(streamOutput || currentSession.result || "")}</div>
        </div>
      ` : ""}
    </div>
  `;

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

  const resultContent = document.getElementById("result-content");
  if (resultContent) resultContent.scrollTop = resultContent.scrollHeight;
}

function renderChatMessages() {
  if (!currentSession || currentSession.chatMessages.length === 0) {
    return '<p class="text-sm text-secondary">暂无补充说明</p>';
  }
  return currentSession.chatMessages.map((msg) => `
    <div class="chat-msg">
      <div class="chat-msg-user">${msg.role === "user" ? "你" : "系统"}</div>
      <div class="chat-msg-content">${escapeHtml(msg.content)}</div>
    </div>
  `).join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function statusLabel(status) {
  const labels = { idle: "等待中", running: "执行中", completed: "已完成", error: "出错" };
  return labels[status] || status;
}

function closeSessionsPanel() {
  const panel = document.getElementById("sessions-panel");
  if (panel) panel.classList.add("hidden");
  currentApp = null;
  currentSession = null;
  appManifest = null;
  loadInstalledApps();
}

function closeSessionView() {
  currentSession = null;
  formFrozen = false;
  streamOutput = "";
  loadAppSessions();
}

async function showAppDetail(appName) {
  const manifest = await api(`/api/apps/${appName}/manifest`);
  if (!manifest) return;
  renderAppDetailModal(manifest);
}

function renderAppDetailModal(manifest) {
  const overlay = document.createElement("div");
  overlay.id = "app-detail-overlay";
  overlay.className = "modal-overlay";
  overlay.onclick = closeAppDetail;

  const deps = manifest.dependencies || {};
  const skills = deps.skills || [];
  const mcps = deps.mcps || [];
  const fields = manifest.fields || [];

  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h2>${escapeHtml(manifest.name || "未知")}</h2>
        <button class="btn btn-secondary btn-small" onclick="closeAppDetail()">关闭</button>
      </div>
      <div class="modal-body">
        <div class="detail-row">
          <span class="detail-label">版本</span>
          <span class="detail-value">v${escapeHtml(manifest.version || "unknown")}</span>
        </div>
        ${manifest.description ? `
        <div class="detail-row">
          <span class="detail-label">描述</span>
          <span class="detail-value">${escapeHtml(manifest.description)}</span>
        </div>` : ""}
        ${manifest.author ? `
        <div class="detail-row">
          <span class="detail-label">作者</span>
          <span class="detail-value">${escapeHtml(manifest.author)}</span>
        </div>` : ""}
        ${skills.length > 0 ? `
        <div class="detail-row">
          <span class="detail-label">依赖 Skills</span>
          <span class="detail-value">${skills.map(s => `<code>${escapeHtml(s)}</code>`).join(", ")}</span>
        </div>` : ""}
        ${mcps.length > 0 ? `
        <div class="detail-row">
          <span class="detail-label">依赖 MCPs</span>
          <span class="detail-value">${mcps.map(m => `<code>${escapeHtml(m)}</code>`).join(", ")}</span>
        </div>` : ""}
        ${fields.length > 0 ? `
        <div class="detail-row">
          <span class="detail-label">表单字段</span>
          <div class="detail-value">
            <table class="detail-table">
              <thead><tr><th>字段名</th><th>类型</th><th>必填</th></tr></thead>
              <tbody>
                ${fields.map(f => `
                  <tr>
                    <td>${escapeHtml(f.label)} (${escapeHtml(f.key)})</td>
                    <td>${f.type}</td>
                    <td>${f.required ? "是" : "否"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>` : ""}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeAppDetail() {
  const overlay = document.getElementById("app-detail-overlay");
  if (overlay) overlay.remove();
}

async function installApp(fileName) {
  try {
    await api("/api/apps/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });
    showSuccess("安装成功");
    loadStoreApps();
    loadInstalledApps();
  } catch (err) {
    showError("安装失败: " + err.message);
  }
}

async function uninstallApp(appName) {
  if (!confirm(`确定要卸载 "${appName}" 吗？相关会话数据也会被删除。`)) return;
  try {
    await api(`/api/apps/${appName}`, { method: "DELETE" });
    showSuccess("卸载成功");
    if (currentApp === appName) {
      currentApp = null;
      currentSession = null;
      appManifest = null;
    }
    loadInstalledApps();
  } catch (err) {
    showError("卸载失败: " + err.message);
  }
}

// ========== Inline Notification Display ==========
function showNotification(message, type) {
  clearInlineError();
  inlineError = { message };
  const el = document.getElementById("inline-error");
  if (!el) return;
  el.textContent = message;
  el.style.color = type === "success" ? "var(--success)" : "var(--error)";
  inlineError.timer = setTimeout(clearInlineError, 3000);
}

function showError(message) {
  showNotification(message, "error");
}

function showSuccess(message) {
  showNotification(message, "success");
}

function clearInlineError() {
  if (inlineError?.timer) clearTimeout(inlineError.timer);
  inlineError = null;
  const el = document.getElementById("inline-error");
  if (el) {
    el.textContent = "";
    el.style.color = "";
  }
}

// ========== Navigation ==========
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    const page = tab.dataset.page;
    document.getElementById(`page-${page}`)?.classList.add("active");
    currentPage = page;

    if (page === "apps") loadInstalledApps();
    if (page === "store") loadStoreApps();
  });
});

const searchEl = document.getElementById("store-search");
if (searchEl) searchEl.addEventListener("input", renderStoreApps);

const sortEl = document.getElementById("store-sort");
if (sortEl) sortEl.addEventListener("change", loadStoreApps);

// ========== Init ==========
loadInstalledApps();
