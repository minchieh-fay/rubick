use axum::{Json, Router, extract::State, http::StatusCode, routing::post};
use serde::Serialize;

use crate::{
    app::AppState,
    works::{HeartbeatRequest, RegisterRequest},
};

// 表示子服务注册成功后的 Epoch 响应。
#[derive(Serialize)]
struct RegisterResponse {
    registry_epoch: String,
}

// 表示 Rubick 对子服务心跳的确认或重新注册要求。
#[derive(Serialize)]
struct HeartbeatResponse {
    status: &'static str,
    interval: u64,
}

// 注册子服务的注册和心跳接口。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/works/register", post(register))
        .route("/api/works/heartbeat", post(heartbeat))
}

// 保存子服务注册并返回新分配的 Epoch。
async fn register(
    State(state): State<AppState>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, (StatusCode, String)> {
    state
        .registry
        .register(request)
        .await
        .map(|registry_epoch| Json(RegisterResponse { registry_epoch }))
        .map_err(|message| (StatusCode::BAD_REQUEST, message.to_string()))
}

// 刷新注册服务的存活时间，或要求失效服务重新注册。
async fn heartbeat(
    State(state): State<AppState>,
    Json(request): Json<HeartbeatRequest>,
) -> Json<HeartbeatResponse> {
    let accepted = state
        .registry
        .heartbeat(request, state.config.rubick.expire_after_seconds)
        .await;
    Json(HeartbeatResponse {
        status: if accepted {
            "OK"
        } else {
            "REGISTRATION_REQUIRED"
        },
        interval: state.config.rubick.heartbeat_interval_seconds,
    })
}
