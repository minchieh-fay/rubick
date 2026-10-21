use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderValue, StatusCode, header},
    response::Response,
    routing::get,
};
use serde::Serialize;

use crate::{app::AppState, works::SkillMetadata};

// 包装 Box 返回的本地 Skill 元数据列表。
#[derive(Serialize)]
struct SkillList {
    skills: Vec<SkillMetadata>,
}

// 注册 Box 面向 Agent 和 Rubick 的 Skill 读取接口。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/skill", get(entry_skill))
        .route("/api/skills", get(list_skills))
        .route("/api/skills/{id}", get(skill_detail))
}

// 返回入口 Skill 文件与按配置生成的 API 说明。
async fn entry_skill(State(state): State<AppState>) -> Result<Response, StatusCode> {
    let content = state
        .skills
        .entry_skill()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(markdown_response(content))
}

// 返回外置目录中的 Skill 元数据列表。
async fn list_skills(State(state): State<AppState>) -> Result<Json<SkillList>, StatusCode> {
    let skills = state
        .skills
        .metadata()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SkillList { skills }))
}

// 返回单个 Skill 的 Markdown 正文和动态接口说明。
async fn skill_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Response, StatusCode> {
    let content = state.skills.skill(&id).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            StatusCode::NOT_FOUND
        } else if error.kind() == std::io::ErrorKind::InvalidInput {
            StatusCode::NOT_FOUND
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;
    Ok(markdown_response(content))
}

// 将 Markdown 正文包装为协议要求的 HTTP 响应。
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
