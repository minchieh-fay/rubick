use crate::{
    app::AppState,
    connection::{self, SshTarget},
};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderValue, StatusCode, header},
    response::Response,
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};

// 接收一次性 SSH 命令及其可选等待时限。
#[derive(Deserialize)]
struct CommandRequest {
    #[serde(flatten)]
    target: SshTarget,
    command: String,
    timeout_seconds: Option<u64>,
}
// 返回短命令的退出码和输出正文。
#[derive(Serialize)]
struct CommandResponse {
    exit_code: Option<i32>,
    output: String,
}
// 接收持久终端会话的目标和可选初始命令。
#[derive(Deserialize)]
struct SessionRequest {
    #[serde(flatten)]
    target: SshTarget,
    command: Option<String>,
}
// 返回新建会话 ID 与空闲过期时限。
#[derive(Serialize)]
struct SessionCreated {
    session_id: String,
    idle_timeout_seconds: u64,
}
// 接收写入远端终端的文本或控制字符。
#[derive(Deserialize)]
struct InputRequest {
    input: String,
}
// 接收会话输出的字节游标。
#[derive(Deserialize)]
struct OutputQuery {
    since: Option<usize>,
}
// 返回会话新增输出、游标和远端退出状态。
#[derive(Serialize)]
struct OutputResponse {
    output: String,
    start_offset: usize,
    next_offset: usize,
    exited: Option<i32>,
}

// 注册 SSH 服务的命令与会话 HTTP 接口。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/skills", get(list_skills))
        .route("/api/skills/{id}", get(skill_detail))
        .route("/api/commands/execute", post(execute_command))
        .route("/api/sessions", post(create_session))
        .route("/api/sessions/{id}/output", get(read_output))
        .route("/api/sessions/{id}/input", post(write_input))
        .route("/api/sessions/{id}", delete(close_session))
}

// 包装子服务 Skill 元数据列表。
#[derive(Serialize)]
struct SkillList {
    skills: Vec<SkillMetadata>,
}
// 表示 SSH 子服务注册给 Rubick 的 Skill 元数据。
#[derive(Serialize)]
struct SkillMetadata {
    id: String,
    name: String,
    description: String,
}

// 返回注册给 Rubick 的 SSH 技能元数据。
async fn list_skills() -> Json<SkillList> {
    Json(SkillList {
        skills: vec![SkillMetadata {
            id: "ssh".into(),
            name: "SSH 远程 Linux 服务器".into(),
            description: "通过 SSH 连接并远程操作 Linux 服务器，执行命令、查看系统信息、管理进程和交互式终端任务。".into(),
        }],
    })
}

// 返回指定外置 Skill 文件的完整 Markdown 正文。
async fn skill_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Response, StatusCode> {
    if id != "ssh" {
        return Err(StatusCode::NOT_FOUND);
    }
    let path = state
        .config
        .path(&state.config.ssh.skill_dir.join("SKILL_ssh.md"));
    let mut content = tokio::fs::read_to_string(path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    content.push_str(&format!(
        "\n\n## 服务地址\n\n{}\n",
        state.config.common.domain
    ));
    Ok(markdown_response(content))
}

// 设置 Skill Markdown 响应类型和禁止缓存标记。
fn markdown_response(content: String) -> Response {
    let mut response = Response::new(content.into());
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/markdown; charset=utf-8"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

// 在配置主机上执行一个带最大时限的短命令。
async fn execute_command(
    State(state): State<AppState>,
    Json(request): Json<CommandRequest>,
) -> Result<Json<CommandResponse>, StatusCode> {
    // step.1 限制请求超时并解析配置目标
    let timeout = request
        .timeout_seconds
        .unwrap_or(state.config.ssh.short_command_timeout_seconds)
        .min(state.config.ssh.short_command_timeout_seconds)
        .max(1);
    // step.2 执行短命令并返回退出码与合并输出
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(timeout),
        connection::run_command(request.target, &request.command),
    )
    .await
    .map_err(|_| StatusCode::GATEWAY_TIMEOUT)??;
    Ok(Json(CommandResponse {
        exit_code: result.0,
        output: result.1,
    }))
}

// 启动一个持久 SSH 终端会话并返回其唯一 ID。
async fn create_session(
    State(state): State<AppState>,
    Json(request): Json<SessionRequest>,
) -> Result<Json<SessionCreated>, StatusCode> {
    // step.1 创建远端 PTY shell 或指定命令会话
    let (id, session) = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        connection::start_session(request.target, request.command.as_deref()),
    )
    .await
    .map_err(|_| StatusCode::GATEWAY_TIMEOUT)??;
    // step.2 保存会话状态并返回超时设置
    state.sessions.lock().await.insert(id.clone(), session);
    Ok(Json(SessionCreated {
        session_id: id,
        idle_timeout_seconds: state.config.ssh.session_idle_timeout_seconds,
    }))
}

// 从会话输出缓冲区按字节偏移读取新增内容并刷新活动时间。
async fn read_output(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<OutputQuery>,
) -> Result<Json<OutputResponse>, StatusCode> {
    // step.1 刷新活动时间并读取会话当前缓冲区
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or(StatusCode::NOT_FOUND)?;
    *session.activity.lock().await = std::time::Instant::now();
    let output = session.output.lock().await;
    // step.2 按全局偏移返回新增输出和当前进度
    let offset = query
        .since
        .unwrap_or(output.start_offset)
        .max(output.start_offset)
        .min(output.next_offset);
    let local_offset = offset - output.start_offset;
    let next_offset = output.next_offset;
    let start_offset = output.start_offset;
    let text = String::from_utf8_lossy(&output.bytes[local_offset..]).into_owned();
    let exited = *session.exited.lock().await;
    Ok(Json(OutputResponse {
        output: text,
        start_offset,
        next_offset,
        exited,
    }))
}

// 将 Agent 提供的终端输入原样写入 SSH 会话。
async fn write_input(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(request): Json<InputRequest>,
) -> Result<StatusCode, StatusCode> {
    // step.1 定位会话并刷新空闲计时
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or(StatusCode::NOT_FOUND)?;
    *session.activity.lock().await = std::time::Instant::now();
    // step.2 将输入送入远端终端并确认写入
    session
        .input
        .send(request.input.into_bytes())
        .await
        .map_err(|_| StatusCode::GONE)?;
    Ok(StatusCode::NO_CONTENT)
}

// 关闭指定会话并结束对应的 SSH 进程。
async fn close_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    // step.1 移除会话并通知 SSH 子进程退出
    let session = state
        .sessions
        .lock()
        .await
        .remove(&id)
        .ok_or(StatusCode::NOT_FOUND)?;
    if let Some(kill) = session.kill {
        let _ = kill.send(());
    }
    // step.2 关闭终端输入流并返回清理结果
    Ok(StatusCode::NO_CONTENT)
}
