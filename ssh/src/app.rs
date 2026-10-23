use std::{collections::HashMap, sync::Arc, time::Instant};

use tokio::sync::{Mutex, mpsc, oneshot};

use crate::config::SshConfig;

// 保存有界输出缓冲及其全局字节偏移。
pub struct OutputBuffer {
    pub bytes: Vec<u8>,
    pub start_offset: usize,
    pub next_offset: usize,
}

impl OutputBuffer {
    // 追加远端输出并将缓冲区限制在 1 MiB。
    pub fn append(&mut self, data: &[u8]) {
        // step.1 追加新输出并更新全局字节游标
        self.bytes.extend_from_slice(data);
        self.next_offset += data.len();
        // step.2 清除最旧内容以维持有界会话缓存
        if self.bytes.len() > 1_048_576 {
            let excess = self.bytes.len() - 1_048_576;
            self.bytes.drain(..excess);
            self.start_offset += excess;
        }
    }
}

// 保存 SSH 配置和所有运行中的终端会话。
#[derive(Clone)]
pub struct AppState {
    pub config: SshConfig,
    pub sessions: Arc<Mutex<HashMap<String, Session>>>,
}

// 保存会话输入、输出、退出状态和最近活动时间。
pub struct Session {
    pub input: mpsc::Sender<Vec<u8>>,
    pub output: Arc<Mutex<OutputBuffer>>,
    pub exited: Arc<Mutex<Option<i32>>>,
    pub activity: Arc<Mutex<Instant>>,
    pub kill: Option<oneshot::Sender<()>>,
}

impl AppState {
    // 创建状态并启动空闲会话的后台清理任务。
    pub fn new(config: SshConfig) -> Self {
        let state = Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        };
        let cleanup_state = state.clone();
        tokio::spawn(async move {
            let mut timer = tokio::time::interval(std::time::Duration::from_secs(15));
            loop {
                timer.tick().await;
                cleanup_state.cleanup_idle_sessions().await;
            }
        });
        state
    }

    // 关闭超过空闲时限的会话并清理其进程资源。
    async fn cleanup_idle_sessions(&self) {
        // step.1 识别超过空闲时限的会话
        let timeout = std::time::Duration::from_secs(self.config.ssh.session_idle_timeout_seconds);
        let mut sessions = self.sessions.lock().await;
        let mut expired = Vec::new();
        for (id, session) in sessions.iter() {
            if session.activity.lock().await.elapsed() >= timeout {
                expired.push(id.clone());
            }
        }
        // step.2 结束远端连接并回收会话记录
        for id in expired {
            if let Some(session) = sessions.remove(&id) {
                if let Some(kill) = session.kill {
                    let _ = kill.send(());
                }
            }
        }
    }
}
