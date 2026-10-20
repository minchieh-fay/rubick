mod help;
pub mod routes;

use std::{collections::HashMap, time::Instant};

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

// 表示子服务向 Rubick 注册的单项技能元数据。
#[derive(Clone, Deserialize, Serialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
}

// 表示子服务启动时提交的注册信息。
#[derive(Deserialize)]
pub struct RegisterRequest {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub port: u16,
    pub skills: Vec<SkillMetadata>,
}

// 表示子服务心跳请求中的注册身份凭据。
#[derive(Deserialize)]
pub struct HeartbeatRequest {
    pub id: String,
    pub registry_epoch: String,
}

// 表示一条存活的子服务注册记录。
#[derive(Clone)]
pub struct ServiceRecord {
    pub id: String,
    pub domain: String,
    pub port: u16,
    pub skills: Vec<SkillMetadata>,
    pub epoch: String,
    pub last_heartbeat: Instant,
}

// 管理子服务注册、技能归属、Epoch 校验和过期清理。
#[derive(Default, Clone)]
pub struct Registry {
    services: std::sync::Arc<RwLock<HashMap<String, ServiceRecord>>>,
}

impl Registry {
    // 注册或覆盖子服务，并为本次注册生成新的 Epoch。
    pub async fn register(&self, request: RegisterRequest) -> Result<String, &'static str> {
        // step.1 校验服务身份和技能元数据的唯一性
        // 调用辅助函数确保服务 ID 可安全映射到公开 HTTP 路径。
        if !help::help_valid_identifier(&request.id)
            || request.name.trim().is_empty()
            || request.domain.trim().is_empty()
            || request.port == 0
        {
            return Err("id、name、domain 和有效 port 均为必填项");
        }
        let mut skill_ids = std::collections::HashSet::new();
        for skill in &request.skills {
            // 调用辅助函数确保 Skill ID 可安全映射到公开 HTTP 路径。
            if !help::help_valid_identifier(&skill.id)
                || skill.name.trim().is_empty()
                || !skill_ids.insert(skill.id.clone())
            {
                return Err("skill id/name 不能为空，且 id 必须唯一");
            }
        }
        // step.2 为注册创建新 Epoch 并覆盖同 ID 的旧记录
        // 调用辅助函数生成本次注册独有的中心 Epoch。
        let epoch = help::help_new_epoch();
        let record = ServiceRecord {
            id: request.id.clone(),
            domain: request.domain.trim_end_matches('/').to_string(),
            port: request.port,
            skills: request.skills,
            epoch: epoch.clone(),
            last_heartbeat: Instant::now(),
        };
        self.services.write().await.insert(request.id, record);
        Ok(epoch)
    }

    // 校验子服务 Epoch 并刷新有效心跳时间。
    pub async fn heartbeat(&self, request: HeartbeatRequest, expiry_seconds: u64) -> bool {
        let mut services = self.services.write().await;
        let Some(service) = services.get(&request.id) else {
            return false;
        };
        if service.last_heartbeat.elapsed().as_secs() > expiry_seconds {
            services.remove(&request.id);
            return false;
        }
        if service.epoch != request.registry_epoch {
            return false;
        }
        if let Some(service) = services.get_mut(&request.id) {
            service.last_heartbeat = Instant::now();
        }
        true
    }

    // 返回全部在线子服务的技能元数据和所属服务信息。
    pub async fn skills(&self) -> Vec<(String, SkillMetadata)> {
        let services = self.services.read().await;
        let mut skills: Vec<_> = services
            .values()
            .flat_map(|service| {
                service
                    .skills
                    .iter()
                    .cloned()
                    .map(|skill| (service.id.clone(), skill))
            })
            .collect();
        skills.sort_by(|left, right| left.1.name.to_lowercase().cmp(&right.1.name.to_lowercase()));
        skills
    }

    // 按 namespaced Skill ID 查找其归属服务和原始元数据。
    pub async fn find_skill(&self, id: &str) -> Option<(ServiceRecord, SkillMetadata)> {
        let services = self.services.read().await;
        services.values().find_map(|service| {
            // 调用辅助函数按服务 ID 和技能 ID 计算注册表中的公开 ID。
            service
                .skills
                .iter()
                .find(|skill| help::help_namespaced_skill_id(&service.id, &skill.id) == id)
                .map(|skill| (service.clone(), skill.clone()))
        })
    }

    // 移除超过配置时限未发送有效心跳的服务及其技能。
    pub async fn remove_expired(&self, expiry_seconds: u64) {
        let mut services = self.services.write().await;
        services.retain(|_, service| service.last_heartbeat.elapsed().as_secs() <= expiry_seconds);
    }
}
