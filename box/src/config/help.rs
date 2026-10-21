use std::path::PathBuf;

// 提供 Box 未显式配置时使用的十分钟刷新周期。
pub(super) fn help_default_reload_interval() -> u64 {
    600
}

// 提供 Box 入口 Skill 的默认外置文件名。
pub(super) fn help_default_entry_skill() -> PathBuf {
    PathBuf::from("SKILL.md")
}
