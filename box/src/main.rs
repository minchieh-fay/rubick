mod app;
mod config;
mod routes;
mod skills;
mod works;

use std::{env, error::Error, net::SocketAddr, path::PathBuf, time::Duration};

use app::AppState;
use axum::Router;
use config::BoxConfig;
use skills::SkillRepository;
use works::RegistrationClient;

#[tokio::main]
// 加载 Box 配置、注册技能并启动 HTTP 服务。
async fn main() -> Result<(), Box<dyn Error>> {
    // step.1 读取配置并初始化外置技能仓库与注册客户端
    let config_path = config_path()?;
    let config = BoxConfig::load(&config_path)?;
    let base_dir = config_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let skills = SkillRepository::new(
        base_dir.join(&config.box_config.skill_dir),
        base_dir.join(&config.box_config.entry_skill_file),
    );
    let client = RegistrationClient::new(config.clone())?;
    let metadata = skills.metadata()?;
    let epoch = client.register(metadata).await?;
    let state = AppState {
        config: config.clone(),
        skills,
        client: client.clone(),
        epoch: std::sync::Arc::new(tokio::sync::Mutex::new(epoch)),
    };
    let task_state = state.clone();
    let app = Router::new().merge(routes::router()).with_state(state);
    // step.2 保持注册心跳并周期刷新外置技能目录
    tokio::spawn(async move {
        let mut timer = tokio::time::interval(Duration::from_secs(1));
        let mut elapsed = 0u64;
        let mut next_heartbeat = 30u64;
        let mut registered_metadata = task_state.skills.metadata().unwrap_or_default();
        loop {
            timer.tick().await;
            elapsed += 1;
            if elapsed % task_state.config.box_config.reload_interval_seconds == 0 {
                if let Ok(metadata) = task_state.skills.metadata() {
                    if metadata != registered_metadata {
                        if let Ok(new_epoch) = task_state.client.register(metadata.clone()).await {
                            *task_state.epoch.lock().await = new_epoch;
                            registered_metadata = metadata;
                        }
                    }
                }
            }
            if elapsed >= next_heartbeat {
                let epoch = task_state.epoch.lock().await.clone();
                match task_state.client.heartbeat(&epoch).await {
                    Ok((true, interval)) => {
                        next_heartbeat = elapsed + interval.max(1);
                    }
                    Ok((false, interval)) => {
                        next_heartbeat = elapsed + interval.max(1);
                        if let Ok(metadata) = task_state.skills.metadata() {
                            if let Ok(new_epoch) =
                                task_state.client.register(metadata.clone()).await
                            {
                                *task_state.epoch.lock().await = new_epoch;
                                registered_metadata = metadata;
                            }
                        }
                    }
                    Err(error) => eprintln!("Box heartbeat failed: {error}"),
                }
            }
        }
    });
    // step.3 监听配置指定端口并提供 Skill HTTP 接口
    let address = SocketAddr::from(([0, 0, 0, 0], config.common.port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!(
        "{} listening on 0.0.0.0:{}",
        config.common.id, config.common.port
    );
    axum::serve(listener, app).await?;
    Ok(())
}

// 解析统一的 --config 参数并返回配置路径。
fn config_path() -> Result<PathBuf, Box<dyn Error>> {
    let mut args = env::args().skip(1);
    let mut path = PathBuf::from("config.toml");
    while let Some(arg) = args.next() {
        if arg == "--config" {
            path = args.next().ok_or("--config 后必须提供配置文件路径")?.into();
        } else {
            return Err(format!("未知参数: {arg}").into());
        }
    }
    Ok(path)
}
