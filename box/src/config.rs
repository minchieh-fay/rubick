mod help;

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::Deserialize;

// 保存 Box 对外身份、监听端口和 Rubick 地址。
#[derive(Clone, Deserialize)]
pub struct CommonConfig {
    pub domain: String,
    pub port: u16,
    pub id: String,
    pub rubick_domain: String,
}

// 保存 Box 的外置 Skill 目录和刷新周期。
#[derive(Clone, Deserialize)]
pub struct BoxSection {
    pub skill_dir: PathBuf,
    #[serde(default = "help::help_default_reload_interval")]
    pub reload_interval_seconds: u64,
}

// 汇总 Box 启动所需的完整配置。
#[derive(Clone, Deserialize)]
pub struct BoxConfig {
    pub common: CommonConfig,
    #[serde(rename = "box")]
    pub box_config: BoxSection,
}

impl BoxConfig {
    // 从指定 TOML 文件加载并校验 Box 配置。
    pub fn load(path: &Path) -> Result<Self, io::Error> {
        // step.1 读取并解析用户提供的服务配置
        let contents = fs::read_to_string(path).map_err(|error| {
            io::Error::new(
                error.kind(),
                format!("无法读取配置文件 {}: {error}", path.display()),
            )
        })?;
        let config: Self = toml::from_str(&contents).map_err(|error| {
            io::Error::other(format!("解析配置文件 {} 失败: {error}", path.display()))
        })?;
        // step.2 校验服务身份、地址和技能扫描参数
        if config.common.id.trim().is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "common.id 不能为空",
            ));
        }
        if config.common.rubick_domain.trim().is_empty()
            || config.common.port == 0
            || config.box_config.reload_interval_seconds == 0
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Rubick 地址、端口和刷新周期必须有效",
            ));
        }
        Ok(config)
    }
}
