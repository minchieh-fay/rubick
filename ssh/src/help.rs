use std::{env, path::PathBuf};

// 解析统一的 --config 参数并返回配置文件路径。
pub fn help_config_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
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
