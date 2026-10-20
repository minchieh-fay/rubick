mod app;
mod config;
mod routes;
mod skills;
mod works;

use std::{env, error::Error, net::SocketAddr, path::PathBuf, time::Duration};

use app::AppState;
use axum::Router;
use config::RubickConfig;
use skills::SkillRepository;
use works::Registry;

#[tokio::main]
// 读取配置并启动 Rubick 技能中心 HTTP 服务。
async fn main() -> Result<(), Box<dyn Error>> {
    // step.1 读取配置文件路径并加载服务配置
    let config_path = config_path()?;
    let config = RubickConfig::load(&config_path)?;
    // step.2 根据配置装配技能仓库、服务注册表和 HTTP 路由
    let skills = SkillRepository::new(
        config_path
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join(&config.rubick.skill_file),
    );
    let registry = Registry::default();
    let state = AppState {
        config: config.clone(),
        skills,
        registry: registry.clone(),
        client: reqwest::Client::new(),
    };
    let app = Router::new().merge(routes::router()).with_state(state);
    // step.3 按配置启动心跳清理任务并监听 HTTP 请求
    tokio::spawn(async move {
        let interval = Duration::from_secs(config.rubick.heartbeat_interval_seconds);
        let mut timer = tokio::time::interval(interval);
        loop {
            timer.tick().await;
            registry
                .remove_expired(config.rubick.expire_after_seconds)
                .await;
        }
    });
    let address = SocketAddr::from(([0, 0, 0, 0], config.common.port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!(
        "{} listening at {}",
        config.common.name, config.common.domain
    );
    axum::serve(listener, app).await?;
    Ok(())
}

// 解析 --config 参数并在缺省时使用当前目录的 config.toml。
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
