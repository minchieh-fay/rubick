use std::io;

use super::{
    HeartbeatRequest, HeartbeatResponse, RegisterRequest, RegisterResponse, SkillMetadata, help,
};
use crate::config::BoxConfig;

// 管理 Box 向 Rubick 注册技能和发送有效心跳。
#[derive(Clone)]
pub struct RegistrationClient {
    config: BoxConfig,
    client: reqwest::Client,
}

impl RegistrationClient {
    // 创建带 HTTP 客户端的注册管理器。
    pub fn new(config: BoxConfig) -> Result<Self, reqwest::Error> {
        Ok(Self {
            config,
            client: reqwest::Client::builder().build()?,
        })
    }

    // 上报服务身份及当前技能元数据并接收注册 Epoch。
    pub async fn register(&self, skills: Vec<SkillMetadata>) -> Result<String, io::Error> {
        // step.1 组装并发送服务注册请求
        let request = RegisterRequest {
            id: self.config.common.id.clone(),
            domain: self.config.common.domain.clone(),
            port: self.config.common.port,
            skills,
        };
        // 调用辅助函数拼接 Rubick 注册接口地址。
        let response = self
            .client
            .post(help::help_endpoint(
                &self.config.common.rubick_domain,
                "/api/works/register",
            ))
            .json(&request)
            .send()
            .await
            .map_err(io::Error::other)?;
        if !response.status().is_success() {
            return Err(io::Error::other(format!(
                "Rubick 注册失败: {}",
                response.status()
            )));
        }
        // step.2 解析并返回中心服务分配的 Epoch
        let response: RegisterResponse = response.json().await.map_err(io::Error::other)?;
        Ok(response.registry_epoch)
    }

    // 使用当前 Epoch 刷新心跳并返回中心是否认可注册。
    pub async fn heartbeat(&self, epoch: &str) -> Result<(bool, u64), io::Error> {
        let request = HeartbeatRequest {
            id: self.config.common.id.clone(),
            registry_epoch: epoch.to_string(),
        };
        // 调用辅助函数拼接 Rubick 心跳接口地址。
        let response = self
            .client
            .post(help::help_endpoint(
                &self.config.common.rubick_domain,
                "/api/works/heartbeat",
            ))
            .json(&request)
            .send()
            .await
            .map_err(io::Error::other)?;
        if !response.status().is_success() {
            return Err(io::Error::other(format!(
                "Rubick 心跳失败: {}",
                response.status()
            )));
        }
        let response: HeartbeatResponse = response.json().await.map_err(io::Error::other)?;
        Ok((response.status == "OK", response.interval))
    }
}
