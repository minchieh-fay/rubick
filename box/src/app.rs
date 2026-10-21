use crate::{config::BoxConfig, skills::SkillRepository, works::RegistrationClient};

// 保存路由与后台注册任务共用的服务状态。
#[derive(Clone)]
pub struct AppState {
    pub config: BoxConfig,
    pub skills: SkillRepository,
    pub client: RegistrationClient,
    pub epoch: std::sync::Arc<tokio::sync::Mutex<String>>,
}
