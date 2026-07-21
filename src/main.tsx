import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type IconProps = { size?: number };
const Icon = ({ name, size = 16 }: IconProps & { name: string }) => <span className={`ui-icon icon-${name}`} style={{ width: size, height: size }} aria-hidden="true" />;
const Plus = (p: IconProps) => <Icon name="plus" {...p} />;
const More = (p: IconProps) => <Icon name="more" {...p} />;
const Loader = (p: IconProps) => <Icon name="loader" {...p} />;
const FileUp = (p: IconProps) => <Icon name="file-up" {...p} />;
const X = (p: IconProps) => <Icon name="x" {...p} />;
const Play = (p: IconProps) => <Icon name="play" {...p} />;
const Pause = (p: IconProps) => <Icon name="pause" {...p} />;
const Trash = (p: IconProps) => <Icon name="trash" {...p} />;
const Bot = (p: IconProps) => <Icon name="bot" {...p} />;
const Branch = (p: IconProps) => <Icon name="git-branch" {...p} />;

type Task = { id: string; title: string; status: string; waitingQuestion?: string | null; createdAt: string; updatedAt: string };
type Message = { id: string; role: string; content: string; createdAt: string };
type Run = { id: string; nodeId: string; status: string; input: string; output?: string; startedAt: string; finishedAt?: string; currentAgent?: string; currentStartedAt?: string };
type Log = { id: string; source: string; level: string; content: string; createdAt: string };
type FileItem = { name: string; url?: string; file?: File };
type Agent = { id: string; parentId: string | null; name: string; role: string; environmentId?: string | null; environmentName?: string | null; usageCount?: number };
type Environment = { id: string; name: string; createdAt: string; usageCount?: number };

const taskTones = ['coral', 'sky', 'violet', 'amber', 'mint', 'rose', 'teal', 'lilac', 'peach', 'blue', 'sage', 'plum'];

const toneFromId = (id: string, used: Set<string>) => {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  for (let offset = 0; offset < taskTones.length; offset += 1) {
    const tone = taskTones[(hash + offset) % taskTones.length];
    if (!used.has(tone)) return tone;
  }
  return taskTones[hash % taskTones.length];
};

const api = async <T,>(path: string, options?: RequestInit) => {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
};

const statusText: Record<string, string> = { running: '执行中', waiting_user: '等待补充', paused: '已暂停', completed: '已完成', failed: '失败', cancelled: '已取消', todo: '待执行' };
const columns = [
  { id: 'running', label: '执行中', hint: 'Agent 正在处理' },
  { id: 'waiting_user', label: '等待补充', hint: '需要你的信息' },
  { id: 'paused', label: '已暂停', hint: '稍后继续' },
  { id: 'failed', label: '失败', hint: '需要检查或重试' },
  { id: 'completed', label: '已完成', hint: '最多保留 20 个' },
];

function TaskCard({ task, tone, entering, onOpen, onAction }: { task: Task; tone?: string; entering?: boolean; onOpen: () => void; onAction: (action: 'pause' | 'cancel' | 'resume' | 'delete') => void }) {
  const [menu, setMenu] = useState(false);
  return <article className={`task-card ${task.status} ${tone ? `tone-${tone}` : ''} ${entering ? 'newly-completed' : ''}`} onClick={onOpen}>
    <div className="task-card-top"><span className="task-id">#{task.id.slice(-8)}</span><button className="more-button" title="更多操作" onClick={(event) => { event.stopPropagation(); setMenu(!menu); }}><More size={17} /></button>{menu && <div className="task-menu" onClick={(event) => event.stopPropagation()}>
      {task.status === 'running' && <button onClick={() => onAction('pause')}><Pause size={14} />暂停任务</button>}
      {task.status === 'paused' && <button onClick={() => onAction('resume')}><Play size={14} />继续任务</button>}
      {(task.status === 'running' || task.status === 'waiting_user' || task.status === 'paused') && <button className="danger-text" onClick={() => onAction('cancel')}><X size={14} />取消任务</button>}
      <button className="danger-text" onClick={() => onAction('delete')}><Trash size={14} />删除任务</button>
    </div>}</div>
    <button className="task-open" onClick={onOpen}><h3>{task.title || '未命名任务'}</h3><p>{task.waitingQuestion || '点击查看任务内容和执行过程'}</p></button>
    <footer><span className={`state-dot ${task.status}`} />{statusText[task.status] || task.status}<time>{task.updatedAt ? new Date(task.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</time></footer>
  </article>;
}

function TaskDetail({ task, onClose, onRefresh }: { task: Task; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [detail, setDetail] = useState<{ messages: Message[]; runs: Run[]; workspace: { inputUrl: string } } | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [answer, setAnswer] = useState('');
  const load = async () => { const data = await api<{ messages: Message[]; runs: Run[]; workspace: { inputUrl: string } }>(`/api/sessions/${task.id}`); setDetail(data); const run = data.runs[0]; if (run) setLogs((await api<{ logs: Log[] }>(`/api/runs/${run.id}/logs`)).logs); };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 1800); return () => window.clearInterval(timer); }, [task.id]);
  const run = detail?.runs[0];
  const submitAnswer = async () => { if (!answer.trim()) return; await api(`/api/sessions/${task.id}/resume`, { method: 'POST', body: JSON.stringify({ content: answer }) }); setAnswer(''); await onRefresh(); await load(); };
  return <div className="drawer-backdrop" onClick={onClose}><aside className="task-drawer" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">任务详情</span><h2>{task.title}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></header>
    <div className={`detail-status ${task.status}`}><span className={`state-dot ${task.status}`} /><strong>{statusText[task.status]}</strong>{run?.currentAgent && <span>当前 Agent：{run.currentAgent}</span>}</div>
    {task.waitingQuestion && <section className="question-box"><strong>需要你的补充</strong><p>{task.waitingQuestion}</p><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="填写资料后继续任务" /><button className="primary-button" disabled={!answer.trim()} onClick={() => void submitAnswer()}><Play size={15} />提交并继续</button></section>}
    <section className="detail-section"><h3>任务内容</h3>{detail?.messages.map((message) => <div className={`detail-message ${message.role}`} key={message.id}><span>{message.role === 'user' ? '用户' : 'Agent'}</span><pre>{message.content}</pre></div>)}</section>
    <section className="detail-section"><h3>执行过程</h3>{logs.length === 0 && <p className="muted">暂时没有运行记录</p>}{logs.map((log) => <div className={`log-row ${log.level}`} key={log.id}><div><strong>{log.source.replace(/^codex:/, '')}</strong><time>{new Date(log.createdAt).toLocaleTimeString('zh-CN')}</time></div><pre>{log.content}</pre></div>)}</section>
    {detail?.runs.some((item) => item.output) && <section className="detail-section"><h3>执行结果</h3>{detail.runs.filter((item) => item.output).map((item) => <pre className="result-output" key={item.id}>{item.output}</pre>)}</section>}
  </aside></div>;
}

function NewTask({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [content, setContent] = useState(''); const [files, setFiles] = useState<FileItem[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [templateApplied, setTemplateApplied] = useState(false);
  const applyTemplate = () => { setTemplateApplied(true); setContent('查看服务器磁盘大小:\n服务器 ip: {ip}\nSSH 端口: {port}\n'); };
  const addFiles = (items: FileList | File[]) => setFiles((current) => [...current, ...Array.from(items).map((file) => ({ name: file.name, file }))]);
  const create = async () => { const variables = [...content.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]); if (variables.length) { setError(`请先填写模板变量：${variables.join('、')}`); return; } if (!content.trim()) { setError('请填写任务内容'); return; } setBusy(true); setError(''); try { const result = await api<{ sessionId: string }>('/api/sessions', { method: 'POST', body: JSON.stringify({ content, templateId: templateApplied ? 'server-disk' : undefined }) }); for (const item of files) { if (!item.file) continue; const form = new FormData(); form.append('file', item.file); await fetch(`/api/sessions/${result.sessionId}/input`, { method: 'POST', body: form }); } await onCreated(); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : '创建失败'); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onClick={onClose}><section className="task-editor" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">新建任务</span><h2>把目标交给 Agent 团队</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></header><div className="editor-toolbar"><button onClick={applyTemplate}>插入服务器检查模板</button><label><FileUp size={15} />添加附件<input type="file" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); }} /></label><span>支持 Markdown、图片粘贴和附件</span></div><textarea className="task-input" autoFocus value={content} onChange={(event) => setContent(event.target.value)} onPaste={(event) => { const images = Array.from(event.clipboardData.items).map((item) => item.kind === 'file' ? item.getAsFile() : null).filter(Boolean) as File[]; if (images.length) { event.preventDefault(); addFiles(images); } }} placeholder="描述目标、上下文、约束和期望产物..." />{files.length > 0 && <div className="file-list">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button></span>)}</div>}{error && <div className="form-error">{error}</div>}<footer className="editor-footer"><span>创建后任务会立即进入执行队列</span><button className="primary-button" disabled={busy} onClick={() => void create()}>{busy ? <Loader size={15} /> : <Plus size={15} />}创建任务</button></footer></section></div>;
}

function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]); const [environments, setEnvironments] = useState<Environment[]>([]); const [environmentSearch, setEnvironmentSearch] = useState(''); const [agentSearch, setAgentSearch] = useState(''); const [uploading, setUploading] = useState(false); const [tab, setTab] = useState<'agents' | 'tree'>('agents'); const [expanded, setExpanded] = useState<Set<string>>(new Set()); const [addingTo, setAddingTo] = useState<string | null>(null); const [newName, setNewName] = useState(''); const [newRole, setNewRole] = useState('业务协作'); const [newEnvironment, setNewEnvironment] = useState('');
  const load = async (search = environmentSearch) => { const data = await api<{ tree: Agent[]; environments: Environment[] }>(`/api/bootstrap?environmentSearch=${encodeURIComponent(search)}`); setAgents(data.tree); setEnvironments(data.environments); setExpanded((current) => current.size ? new Set([...current].filter((id) => data.tree.some((agent) => agent.id === id))) : new Set(data.tree.filter((agent) => agent.parentId === null).map((agent) => agent.id))); };
  useEffect(() => { const timer = window.setTimeout(() => void load(environmentSearch), 250); return () => window.clearTimeout(timer); }, [environmentSearch]);
  const upload = async (file: File) => { setUploading(true); try { const form = new FormData(); form.append('file', file); const response = await fetch('/api/environments/upload', { method: 'POST', body: form }); if (!response.ok) window.alert(((await response.json()) as { error?: string }).error || '上传失败'); await load(); } finally { setUploading(false); } };
  const removeEnvironment = async (item: Environment) => { if (!window.confirm(`删除环境“${item.name}”？`)) return; try { await api(`/api/environments/${item.id}`, { method: 'DELETE' }); await load(); } catch (error) { window.alert(error instanceof Error ? error.message : '删除失败'); } };
  const children = (parentId: string | null) => agents.filter((agent) => agent.parentId === parentId);
  const hasChildren = (id: string) => children(id).length > 0;
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const addNode = async () => { if (!addingTo || !newName.trim()) return; try { await api('/api/agents/nodes', { method: 'POST', body: JSON.stringify({ parentId: addingTo, name: newName.trim(), role: newRole, environmentId: newEnvironment || undefined }) }); setNewName(''); setAgentSearch(''); setAddingTo(null); await load(); } catch (error) { window.alert(error instanceof Error ? error.message : '添加失败'); } };
  const removeNode = async (agent: Agent) => { if (agent.id === 'root-orchestrator') return; if (!window.confirm(`删除“${agent.name}”及其下级节点？`)) return; try { await api(`/api/agents/nodes/${agent.id}`, { method: 'DELETE' }); await load(); } catch (error) { window.alert(error instanceof Error ? error.message : '删除失败'); } };
  const parentAgent = addingTo ? agents.find((agent) => agent.id === addingTo) : null;
  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => children(parentId).map((agent) => { const open = expanded.has(agent.id); return <React.Fragment key={agent.id}><div className={`agent-tree-row ${agent.id === 'root-orchestrator' ? 'root-tree-row' : ''}`} style={{ paddingLeft: 10 + depth * 24 }}><button className="tree-toggle" aria-label={open ? '折叠节点' : '展开节点'} title={open ? '折叠节点' : '展开节点'} disabled={!hasChildren(agent.id)} onClick={() => toggle(agent.id)}>{hasChildren(agent.id) ? (open ? '⌄' : '›') : <span className="tree-leaf" />}</button><span className="tree-node-icon"><Bot size={15} /></span><div className="tree-node-copy"><strong>{agent.name}</strong><small>{agent.role}</small></div>{agent.environmentName && <span className="binding-label">环境：{agent.environmentName}</span>}<span className="tree-usage">使用 {agent.usageCount ?? 0} 次</span><button className="tree-action" title="添加下级" onClick={() => setAddingTo(agent.id)}><Plus size={13} />添加子节点</button><button className="tree-action danger-text" title={agent.id === 'root-orchestrator' ? '根节点不可删除' : '删除节点'} disabled={agent.id === 'root-orchestrator'} onClick={() => void removeNode(agent)}><Trash size={13} />删除</button></div>{open && renderTree(agent.id, depth + 1)}</React.Fragment>; });
  const allExpanded = agents.length > 0 && agents.every((agent) => !hasChildren(agent.id) || expanded.has(agent.id));
  const availableAgents = environments.filter((environment) => environment.name.toLocaleLowerCase().includes(agentSearch.trim().toLocaleLowerCase()));
  return <section className="agents-page"><div className="management-head"><div><span className="eyebrow">AGENT MANAGEMENT</span><h2>Agent 管理</h2><p>{tab === 'agents' ? '管理可执行 Agent 的环境 Bundle。' : '管理 Agent 的组织关系，调度只依赖这里配置的树结构。'}</p></div>{tab === 'agents' && <label className="primary-button"><FileUp size={15} />{uploading ? '上传中' : '上传 ZIP'}<input type="file" accept=".zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} /></label>}</div><div className="agent-tabs" role="tablist"><button className={tab === 'agents' ? 'active' : ''} role="tab" aria-selected={tab === 'agents'} onClick={() => setTab('agents')}><Bot size={15} />Agent</button><button className={tab === 'tree' ? 'active' : ''} role="tab" aria-selected={tab === 'tree'} onClick={() => setTab('tree')}><Branch size={15} />Agent 树</button></div>{tab === 'agents' ? <section className="management-panel standalone-panel"><header><div><h3>环境 Bundle</h3><span>{environments.length} 个</span></div><input className="agent-search" value={environmentSearch} onChange={(event) => setEnvironmentSearch(event.target.value)} placeholder="搜索 Agent" aria-label="搜索 Agent" /></header>{environments.map((environment) => <div className="environment-row" key={environment.id}><Bot size={17} /><div><strong>{environment.name}</strong><small>上传于 {new Date(environment.createdAt).toLocaleDateString('zh-CN')} · 使用 {environment.usageCount ?? 0} 次</small></div><a href={`/api/environments/${environment.id}`} title="下载 Bundle">下载</a><button onClick={() => void removeEnvironment(environment)}>删除</button></div>)}{environments.length === 0 && <p className="muted">{environmentSearch ? '没有匹配的 Agent' : '暂无环境，请上传包含 AGENTS.md 的 ZIP。'}</p>}</section> : <section className="management-panel standalone-panel tree-panel"><header><div><h3>组织结构</h3><span className="panel-caption">{agents.length} 个节点 · 父子关系决定协作范围</span></div><div className="tree-toolbar"><button onClick={() => setExpanded(new Set(agents.map((agent) => agent.id)))} disabled={allExpanded}>展开全部</button><button onClick={() => setExpanded(new Set())} disabled={expanded.size === 0}>折叠全部</button><button className="primary-button compact-button" onClick={() => setAddingTo('root-orchestrator')}><Plus size={14} />添加根节点下级</button></div></header><div className="tree-legend"><span><i className="tree-legend-line" />可展开的父节点</span><span><i className="tree-legend-dot" />叶子 Agent</span></div><div className="agent-tree">{renderTree(null)}{agents.length === 0 && <p className="muted">暂无 Agent 节点</p>}</div>{addingTo && <div className="modal-backdrop tree-modal-backdrop" onClick={() => setAddingTo(null)}><section className="add-node-form" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">ADD CHILD AGENT</span><h3>添加下级 Agent</h3><p>新节点会挂载到选中的父节点下。</p></div><button className="close-button" onClick={() => setAddingTo(null)}><X size={18} /></button></header><div className="parent-node-field"><span>父节点</span><strong>{parentAgent?.name ?? '已选节点'}</strong></div><label>选择 Agent<input autoFocus value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} placeholder="搜索 Agent" />{availableAgents.length > 0 && <div className="agent-picker-options">{availableAgents.map((environment) => <button type="button" className={newEnvironment === environment.id ? 'selected' : ''} key={environment.id} onClick={() => { setNewName(environment.name); setNewEnvironment(environment.id); }}>{environment.name}</button>)}</div>}</label><label>职责<input value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="填写这个节点负责的工作范围" /></label><footer><button className="secondary-button" onClick={() => { setAddingTo(null); setNewName(''); setAgentSearch(''); }}>取消</button><button className="primary-button compact-button" disabled={!newName.trim()} onClick={() => void addNode()}><Plus size={14} />创建 Agent</button></footer></section></div>}</section>}</section>;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]); const [selected, setSelected] = useState<Task | null>(null); const [creating, setCreating] = useState(false); const [activePage, setActivePage] = useState<'board' | 'agents'>('board'); const [search, setSearch] = useState(''); const [toneByTask, setToneByTask] = useState<Record<string, string>>({}); const [newlyCompleted, setNewlyCompleted] = useState<Set<string>>(new Set()); const [completionMotion, setCompletionMotion] = useState(false); const previousTasks = useRef<Record<string, string>>({});
  const refresh = async () => { const data = await api<{ sessions: Task[] }>('/api/bootstrap'); const completedNow = data.sessions.filter((task) => task.status === 'completed' && previousTasks.current[task.id] && previousTasks.current[task.id] !== 'completed').map((task) => task.id); if (completedNow.length) { setNewlyCompleted(new Set(completedNow)); setCompletionMotion(true); window.setTimeout(() => { setNewlyCompleted(new Set()); setCompletionMotion(false); }, 1300); } setToneByTask((current) => { const next = { ...current }; for (let index = data.sessions.length - 1; index >= 0; index -= 1) { const task = data.sessions[index]; if (!next[task.id]) { const used = new Set(data.sessions.slice(index + 1, index + 11).map((item) => next[item.id]).filter(Boolean) as string[]); next[task.id] = toneFromId(task.id, used); } } return next; }); previousTasks.current = Object.fromEntries(data.sessions.map((task) => [task.id, task.status])); setTasks(data.sessions); if (selected) setSelected(data.sessions.find((task) => task.id === selected.id) ?? null); };
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 2200); return () => window.clearInterval(timer); }, []);
  const visible = useMemo(() => tasks.filter((task) => task.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [tasks, search]);
  const action = async (task: Task, actionName: 'pause' | 'cancel' | 'resume' | 'delete') => { if (actionName === 'delete' && !window.confirm('删除这个任务？运行日志将不再出现在看板中。')) return; if (actionName === 'resume') await api(`/api/sessions/${task.id}/resume`, { method: 'POST', body: JSON.stringify({ content: '请继续执行当前任务。' }) }); else if (actionName === 'delete') await api(`/api/sessions/${task.id}`, { method: 'DELETE' }); else await api(`/api/sessions/${task.id}/${actionName}`, { method: 'POST' }); await refresh(); };
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Branch size={18} /></div><div><strong>rubick</strong><span>agent operations</span></div></div><button className="new-task-button" onClick={() => setCreating(true)}><Plus size={17} />新建任务</button><nav><button className={activePage === 'board' ? 'active' : ''} onClick={() => setActivePage('board')}>任务看板</button><button className={activePage === 'agents' ? 'active' : ''} onClick={() => setActivePage('agents')}>Agent 管理</button></nav><div className="sidebar-note">每个 Agent 环境都是独立 Bundle。任务执行过程中可以跨层级协作。</div></aside><main className="main-content"><header className="topbar"><div><span className="eyebrow">RUBICK / {activePage === 'board' ? 'TASK BOARD' : 'AGENTS'}</span><h1>{activePage === 'board' ? '任务看板' : 'Agent 管理'}</h1></div>{activePage === 'board' && <div className="board-actions"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务" /><button className="primary-button" onClick={() => setCreating(true)}><Plus size={15} />新建任务</button></div>}</header>{activePage === 'board' ? <section className="board"><div className="board-intro"><p>查看任务状态、等待事项和 Agent 执行过程。</p><span>{tasks.length} 个任务</span></div><div className="board-grid">{columns.map((column) => { const columnTasks = visible.filter((task) => task.status === column.id); return <section className={`board-column ${column.id} ${column.id === 'completed' && completionMotion ? 'completion-motion' : ''}`} key={column.id}><header><div><h2>{column.label}</h2><span>{column.id === 'completed' && newlyCompleted.size ? `刚刚完成 ${newlyCompleted.size} 个` : column.hint}</span></div><strong>{columnTasks.length}</strong></header><div className="column-cards">{columnTasks.slice(0, column.id === 'completed' ? 20 : 100).map((task) => <TaskCard key={task.id} task={task} tone={toneByTask[task.id]} entering={newlyCompleted.has(task.id)} onOpen={() => setSelected(task)} onAction={(name) => void action(task, name)} />)}{columnTasks.length === 0 && <div className="column-empty">暂无任务</div>}</div></section>; })}</div></section> : <AgentsPage />}</main>{creating && <NewTask onClose={() => setCreating(false)} onCreated={refresh} />}{selected && <TaskDetail task={selected} onClose={() => setSelected(null)} onRefresh={refresh} />}</div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
