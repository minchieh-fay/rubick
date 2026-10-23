// 生成动态追加到 Rubick 外置 Skill 尾部的 API 调用说明。
pub(super) fn help_dynamic_api(base_url: &str, service_id: &str) -> String {
    let base_url = base_url.trim_end_matches('/');
    format!(
        "## 服务地址\n\n\
         {base_url}\n\n\
         ## {service_id} API\n\n\
         - `GET {base_url}/api/skills` 获取在线 Skill 的 id、name 和 description。\n\
         - `GET {base_url}/api/skills/{{namespaced_skill_id}}` 获取指定子服务 Skill 的完整正文。\n\
         - `GET {base_url}/api/skill` 获取当前服务的入口 Skill。\n\n\
         每次处理请求时重新读取在线列表；任务匹配某个 Skill 时，先读取其完整正文。\n\n\
         如果使用 `web_fetch` 访问 API，每次请求都在 URL 后追加 `t=` 和当前 Unix 时间戳，避免读取旧缓存。\n\
         例如：`GET {base_url}/api/skills?t=<当前 Unix 时间戳>`；读取详情时也使用 `?t=<当前 Unix 时间戳>`。"
    )
}

// 将入口 Skill 模板中的 ID 占位符替换为配置的服务 ID。
pub(super) fn help_render_skill_id(source: &str, service_id: &str) -> String {
    source.replace("{{id}}", service_id)
}

// 按中心服务 ID 为 Agent 可见列表中的子服务技能生成 namespaced ID。
pub(super) fn help_namespaced_skill_id(
    center_id: &str,
    service_id: &str,
    skill_id: &str,
) -> String {
    format!("{center_id}_{service_id}_{skill_id}")
}

// 根据服务唯一 ID 和监听端口生成 app-net 内部转发地址。
pub(super) fn help_internal_service_base_url(service_id: &str, port: u16) -> String {
    format!("http://{service_id}.internal:{port}")
}

// 将子服务本地 Skill ID 安全追加到统一详情接口路径。
pub(super) fn help_forward_url(base_url: &str, skill_id: &str) -> Option<reqwest::Url> {
    let endpoint = format!("{}/api/skills", base_url.trim_end_matches('/'));
    let mut url = reqwest::Url::parse(&endpoint).ok()?;
    url.path_segments_mut().ok()?.push(skill_id);
    Some(url)
}
