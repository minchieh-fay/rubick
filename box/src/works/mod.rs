mod client;
mod help;

pub use client::RegistrationClient;

use serde::{Deserialize, Serialize};

// 表示 Box 上报给 Rubick 的单项 Skill 元数据。
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
}

// 表示 Box 向 Rubick 提交的服务注册内容。
#[derive(Serialize)]
pub(super) struct RegisterRequest {
    pub id: String,
    pub domain: String,
    pub port: u16,
    pub skills: Vec<SkillMetadata>,
}

// 表示 Box 心跳时提交的服务身份和注册 Epoch。
#[derive(Serialize)]
pub(super) struct HeartbeatRequest {
    pub id: String,
    pub registry_epoch: String,
}

// 表示 Rubick 成功注册后返回的 Epoch。
#[derive(Deserialize)]
pub(super) struct RegisterResponse {
    pub registry_epoch: String,
}

// 表示 Rubick 对心跳状态和下一周期的确认。
#[derive(Deserialize)]
pub(super) struct HeartbeatResponse {
    pub status: String,
    pub interval: u64,
}
