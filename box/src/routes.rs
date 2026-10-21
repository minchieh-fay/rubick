use axum::Router;

// 汇总 Box 的 Agent Skill 接口。
pub fn router() -> Router<crate::app::AppState> {
    Router::new().merge(crate::skills::routes::router())
}
