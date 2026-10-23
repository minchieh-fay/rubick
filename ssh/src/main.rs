mod app;
mod config;
mod connection;
mod help;
mod routes;

use std::{error::Error, net::SocketAddr, time::Duration};

use app::AppState;
use axum::Router;
use config::SshConfig;

#[tokio::main]
// 加载 SSH 服务配置并启动 HTTP 接口。
async fn main() -> Result<(), Box<dyn Error>> {
    // step.1 读取配置并向 Rubick 注册外置 SSH Skill
    // 调用辅助函数解析标准 --config 参数。
    let path = help::help_config_path()?;
    let config = SshConfig::load(&path)?;
    let port = config.common.port;
    let state = AppState::new(config);
    let epoch = register(&state).await?;
    let heartbeat_state = state.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let mut current_epoch = epoch;
        let mut interval = 30u64;
        loop {
            tokio::time::sleep(Duration::from_secs(interval.max(1))).await;
            let url = format!(
                "{}/api/works/heartbeat",
                heartbeat_state.config.common.rubick_domain
            );
            let result = client
                .post(url)
                .json(&serde_json::json!({
                    "id": heartbeat_state.config.common.id,
                    "registry_epoch": current_epoch
                }))
                .send()
                .await;
            if let Ok(response) = result {
                if let Ok(body) = response.json::<serde_json::Value>().await {
                    interval = body["interval"].as_u64().unwrap_or(30).max(1);
                    if body["status"] == "REGISTRATION_REQUIRED" {
                        if let Ok(new_epoch) = register(&heartbeat_state).await {
                            current_epoch = new_epoch;
                        }
                    }
                }
            }
        }
    });
    // step.2 启动注册心跳并监听 Agent HTTP 请求
    let app = Router::new().merge(routes::router()).with_state(state);
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await?;
    println!("SSH service listening on 0.0.0.0:{port}");
    axum::serve(listener, app).await?;
    Ok(())
}

// 向 Rubick 注册 SSH 服务的技能元数据并返回注册 Epoch。
async fn register(state: &AppState) -> Result<String, Box<dyn Error>> {
    // step.1 上报服务身份和本地 Skill 元数据
    let response = reqwest::Client::new()
        .post(format!(
            "{}/api/works/register",
            state.config.common.rubick_domain
        ))
        .json(&serde_json::json!({
            "id": state.config.common.id,
            "domain": state.config.common.domain,
            "port": state.config.common.port,
            "skills": [{
                "id": "ssh",
                "name": "SSH 远程 Linux 服务器",
                "description": "通过 SSH 连接并远程操作 Linux 服务器，执行命令、查看系统信息、管理进程和交互式终端任务。"
            }]
        }))
        .send()
        .await?
        .error_for_status()?;
    // step.2 校验并保存中心分配的注册 Epoch
    let value: serde_json::Value = response.json().await?;
    Ok(value["registry_epoch"]
        .as_str()
        .ok_or("Rubick 未返回 registry_epoch")?
        .to_owned())
}
