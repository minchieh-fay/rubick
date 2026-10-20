use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static EPOCH_SEQUENCE: AtomicU64 = AtomicU64::new(0);

// 为每次子服务注册生成高精度且进程内唯一性足够的 Epoch。
pub(super) fn help_new_epoch() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let sequence = EPOCH_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("center-epoch-{nanos}-{sequence}")
}

// 组合 Rubick 对外公开的服务和技能 namespaced ID。
pub(super) fn help_namespaced_skill_id(service_id: &str, skill_id: &str) -> String {
    format!("rubick_{service_id}_{skill_id}")
}

// 校验服务和技能 ID 可作为单个 HTTP 路径片段使用。
pub(super) fn help_valid_identifier(value: &str) -> bool {
    !value.trim().is_empty()
        && value != "."
        && value != ".."
        && !value.chars().any(|character| {
            character.is_control() || matches!(character, '/' | '\\' | '?' | '#' | '%')
        })
}
