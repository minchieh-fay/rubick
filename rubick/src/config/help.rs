// 返回 Rubick 默认心跳检查间隔秒数。
pub(super) fn help_default_heartbeat() -> u64 {
    30
}

// 返回服务注册记录的默认过期秒数。
pub(super) fn help_default_expiry() -> u64 {
    50
}

// 返回 Rubick 配置文件所在服务目录内的外置 Skill 相对路径。
pub(super) fn help_default_skill_file() -> std::path::PathBuf {
    "SKILL.md".into()
}

// 校验 Rubick 服务 ID 可安全用作公开 Skill ID 的前缀。
pub(super) fn help_valid_center_id(value: &str) -> bool {
    !value.trim().is_empty()
        && !value.chars().any(|character| {
            character.is_control() || matches!(character, '/' | '\\' | '?' | '#' | '%')
        })
}
