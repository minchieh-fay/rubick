use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::Deserialize;

// 保存子服务通用身份和监听信息。
#[derive(Clone, Deserialize)]
pub struct CommonConfig {
    pub domain: String,
    pub port: u16,
    pub id: String,
    pub rubick_domain: String,
}

// 保存 SSH 服务的会话与命令限制。
#[derive(Clone, Deserialize)]
pub struct SshSection {
    pub short_command_timeout_seconds: u64,
    pub session_idle_timeout_seconds: u64,
    pub skill_dir: PathBuf,
}

// 汇总 SSH 服务启动配置。
#[derive(Clone, Deserialize)]
pub struct SshConfig {
    pub common: CommonConfig,
    #[serde(rename = "ssh")]
    pub ssh: SshSection,
    #[serde(skip)]
    config_dir: PathBuf,
}

impl SshConfig {
    // 读取并校验服务配置。
    pub fn load(path: &Path) -> Result<Self, io::Error> {
        // step.1 读取 TOML 并解析服务运行设置
        let text = fs::read_to_string(path)?;
        let mut config: Self = toml::from_str(&text)
            .map_err(|error| io::Error::other(format!("配置解析失败: {error}")))?;
        config.config_dir = path.parent().unwrap_or(Path::new(".")).to_path_buf();
        // step.2 校验服务身份及运行时限
        if config.common.port == 0
            || config.common.id.trim().is_empty()
            || config.common.rubick_domain.trim().is_empty()
            || config.ssh.short_command_timeout_seconds == 0
            || config.ssh.session_idle_timeout_seconds == 0
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "SSH 配置参数无效",
            ));
        }
        Ok(config)
    }

    // 解析相对于配置文件目录的外置文件路径。
    pub fn path(&self, path: &Path) -> PathBuf {
        self.config_dir.join(path)
    }
}
