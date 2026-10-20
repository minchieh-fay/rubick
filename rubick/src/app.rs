use crate::{config::RubickConfig, skills::SkillRepository, works::Registry};

// 保存路由共享的 Rubick 配置、技能文件、服务注册表和 HTTP 客户端。
#[derive(Clone)]
pub struct AppState {
    pub config: RubickConfig,
    pub skills: SkillRepository,
    pub registry: Registry,
    pub client: reqwest::Client,
}
