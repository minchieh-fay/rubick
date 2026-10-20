use axum::Router;

// 汇总 Agent 技能 API 和子服务注册 API。
pub fn router() -> Router<crate::app::AppState> {
    Router::new()
        .merge(crate::skills::routes::router())
        .merge(crate::works::routes::router())
}
