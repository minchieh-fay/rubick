use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderValue, StatusCode, header},
    response::Response,
    routing::get,
};
use serde::Serialize;

use crate::{app::AppState, skills::help};

// 表示在线子服务 Skill 的公开元数据。
#[derive(Serialize)]
struct SkillSummary {
    id: String,
    name: String,
    description: String,
}

// 包装返回给 Agent 的在线 Skill 元数据列表。
#[derive(Serialize)]
struct SkillList {
    skills: Vec<SkillSummary>,
}

// 注册 Agent 读取 Rubick Skill 和子服务 Skill 的接口。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/skill", get(rubick_skill))
        .route("/api/skills", get(list_skills))
        .route("/api/skills/{id}", get(skill_detail))
}

// 返回当前存活子服务注册的技能元数据，不包含技能正文。
async fn list_skills(State(state): State<AppState>) -> Json<SkillList> {
    let skills = state
        .registry
        .skills()
        .await
        .into_iter()
        .map(|(service_id, skill)| {
            SkillSummary {
                // 调用辅助函数为子服务技能生成全局唯一的 Rubick ID。
                id: help::help_namespaced_skill_id(&service_id, &skill.id),
                name: skill.name,
                description: skill.description,
            }
        })
        .collect();
    Json(SkillList { skills })
}

// 通过注册表定位子服务并原样转发其完整 Markdown Skill 内容。
async fn skill_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Response, StatusCode> {
    // step.1 根据 Rubick Skill ID 定位在线服务和子服务元数据
    let (service, skill) = state
        .registry
        .find_skill(&id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    // 调用辅助函数从子服务注册域名和端口生成上游基地址。
    let base_url = help::help_service_base_url(&service.domain, service.port);
    // step.2 请求子服务 Skill 详情接口并转发响应正文
    // 调用辅助函数安全拼接子服务接口地址及技能 ID。
    let url = super::help::help_forward_url(&base_url, &skill.id).ok_or(StatusCode::BAD_GATEWAY)?;
    let upstream = state
        .client
        .get(url)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    if upstream.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(StatusCode::NOT_FOUND);
    }
    if !upstream.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }
    let body = upstream.text().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let mut response = Response::new(body.into());
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/markdown; charset=utf-8"),
    );
    Ok(response)
}

// 读取外置模板并追加本服务地址和动态生成的 API 使用说明。
async fn rubick_skill(State(state): State<AppState>) -> Result<Response, StatusCode> {
    let content = state
        .skills
        .rubick_skill(&state.config.common.domain)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut response = Response::new(content.into());
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/markdown; charset=utf-8"),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    Ok(response)
}
