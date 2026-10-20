// 生成动态追加到 Rubick 外置 Skill 尾部的 API 调用说明。
pub(super) fn help_dynamic_api(base_url: &str) -> String {
    let base_url = base_url.trim_end_matches('/');
    format!(
        "## 服务地址\n\n\
         {base_url}\n\n\
         ## Rubick API\n\n\
         - `GET {base_url}/api/skills` 获取在线 Skill 的 id、name 和 description。\n\
         - `GET {base_url}/api/skills/{{rubick_skill_id}}` 获取指定子服务 Skill 的完整正文。\n\
         - `GET {base_url}/api/skill` 获取当前服务的入口 Skill。\n\n\
         每次处理请求时重新读取在线列表；任务匹配某个 Skill 时，先读取其完整正文。"
    )
}

// 在 Agent 可见列表中为子服务技能生成 namespaced ID。
pub(super) fn help_namespaced_skill_id(service_id: &str, skill_id: &str) -> String {
    format!("rubick_{service_id}_{skill_id}")
}

// 根据注册的域名和监听端口生成子服务转发基地址。
pub(super) fn help_service_base_url(domain: &str, port: u16) -> String {
    let endpoint = domain.trim_end_matches('/');
    let Ok(mut url) = reqwest::Url::parse(endpoint) else {
        return format!("http://{endpoint}:{port}");
    };
    let _ = url.set_port(Some(port));
    url.to_string().trim_end_matches('/').to_string()
}

// 将子服务本地 Skill ID 安全追加到统一详情接口路径。
pub(super) fn help_forward_url(base_url: &str, skill_id: &str) -> Option<reqwest::Url> {
    let endpoint = format!("{}/api/skills/", base_url.trim_end_matches('/'));
    let mut url = reqwest::Url::parse(&endpoint).ok()?;
    url.path_segments_mut().ok()?.push(skill_id);
    Some(url)
}
