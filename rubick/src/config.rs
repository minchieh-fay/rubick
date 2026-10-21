mod help;

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::Deserialize;

// 表示所有服务通用的身份、域名和监听端口配置。
#[derive(Clone, Deserialize)]
pub struct CommonConfig {
    pub domain: String,
    pub port: u16,
    pub id: String,
}

// 表示 Rubick 专属的技能文件和心跳清理配置。
#[derive(Clone, Deserialize)]
pub struct RubickSection {
    // 使用统一的默认心跳检查周期。
    #[serde(default = "help::help_default_heartbeat")]
    pub heartbeat_interval_seconds: u64,
    // 使用略高于心跳周期的默认失效阈值。
    #[serde(default = "help::help_default_expiry")]
    pub expire_after_seconds: u64,
    // 默认读取服务代码目录中的 Rubick Skill 文件。
    #[serde(default = "help::help_default_skill_file")]
    pub skill_file: PathBuf,
}

// 表示用于启动 Rubick 的完整 TOML 配置。
#[derive(Clone, Deserialize)]
pub struct RubickConfig {
    pub common: CommonConfig,
    pub rubick: RubickSection,
}

impl RubickConfig {
    // 加载工程提供或用户指定的 TOML 配置文件。
    pub fn load(path: &Path) -> Result<Self, io::Error> {
        // step.1 读取配置文件并解析 TOML 服务设置
        let contents = fs::read_to_string(path).map_err(|error| {
            io::Error::new(
                error.kind(),
                format!("无法读取配置文件 {}: {error}", path.display()),
            )
        })?;
        let config: Self = toml::from_str(&contents).map_err(|error| {
            io::Error::other(format!("解析配置文件 {} 失败: {error}", path.display()))
        })?;
        // step.2 校验服务身份、域名和心跳参数
        // 调用辅助函数校验中心 ID 可作为公开 Skill ID 的前缀。
        if !help::help_valid_center_id(&config.common.id) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "common.id 不能为空且必须能安全用于 Skill ID",
            ));
        }
        if config.common.domain.trim().is_empty() || config.common.port == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "common.domain/port 无效",
            ));
        }
        if config.rubick.heartbeat_interval_seconds == 0
            || config.rubick.expire_after_seconds <= config.rubick.heartbeat_interval_seconds
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "心跳过期时间必须大于心跳间隔",
            ));
        }
        Ok(config)
    }
}
