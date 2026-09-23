import { useCallback, useEffect, useState } from 'react'
import './App.css'

type Session = { accessToken: string; refreshToken: string }
type Workspace = { id: string; name: string; slug: string; createdAt: string; roles: string[] }
type MembershipResponse = { workspace: Omit<Workspace, 'roles'>; roles: string[] }
type User = { id: string; name?: string | null; email: string }

const SESSION_KEY = 'shortlink-session'
const API_KEY = 'shortlink-api'

function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null }
  catch { return null }
}

function App() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [apiUrl, setApiUrl] = useState(localStorage.getItem(API_KEY) || '/api')
  const [user, setUser] = useState<User | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}, token = session?.accessToken): Promise<T> => {
    const headers = new Headers(options.headers)
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, { ...options, headers })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string | string[] } | null
      const message = Array.isArray(payload?.message) ? payload.message.join('；') : payload?.message
      throw new Error(message || `请求失败 (${response.status})`)
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }, [apiUrl, session?.accessToken])

  const loadAccount = useCallback(async () => {
    if (!session) return
    setError('')
    try {
      const [me, memberships] = await Promise.all([
        request<User>('/auth/me'),
        request<MembershipResponse[]>('/workspaces'),
      ])
      const items = memberships.map(({ workspace, roles }) => ({ ...workspace, roles }))
      setUser(me)
      setWorkspaces(items)
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法载入账号信息')
    }
  }, [request, session])

  useEffect(() => { void loadAccount() }, [loadAccount])

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    try {
      localStorage.setItem(API_KEY, apiUrl)
      if (authMode === 'register') {
        await request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: form.get('name') || undefined }) }, undefined)
      }
      const result = await request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, undefined)
      localStorage.setItem(SESSION_KEY, JSON.stringify(result))
      setSession(result)
      setNotice(authMode === 'register' ? '账号创建成功，已为你登录。' : '登录成功。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试。')
    } finally { setBusy(false) }
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      await request('/workspaces', { method: 'POST', body: JSON.stringify({ name: form.get('name'), slug: String(form.get('slug')).trim().toLowerCase() }) })
      setShowWorkspaceForm(false)
      setNotice('工作空间已创建。')
      await loadAccount()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建工作空间失败。')
    } finally { setBusy(false) }
  }

  async function signOut() {
    try { await request('/auth/logout', { method: 'POST' }) } catch { /* The local session is cleared even if the network is unavailable. */ }
    localStorage.removeItem(SESSION_KEY)
    setSession(null); setUser(null); setWorkspaces([]); setSelectedId(''); setNotice('')
  }

  const selected = workspaces.find((item) => item.id === selectedId) || null

  if (!session) return <main className="auth-layout">
    <section className="auth-art"><div className="brand"><span className="brand-icon">↗</span> 短链工场</div><div className="art-copy"><span className="overline">SHORTLINK WORKSPACE</span><h1>让每一次分享<br />都有清晰的回响。</h1><p>管理短链接、协作权限与访问数据，让团队分享更简单、更安全。</p><div className="art-graphic"><div className="graphic-ring ring-one" /><div className="graphic-ring ring-two" /><div className="graphic-center">↗</div><span className="graphic-node node-one">LINK</span><span className="graphic-node node-two">DATA</span><span className="graphic-node node-three">TEAM</span></div></div><div className="art-foot">链接管理 · 团队协作 · 数据洞察</div></section>
    <section className="auth-content"><form className="auth-form" onSubmit={submitAuth}><div className="form-kicker">{authMode === 'login' ? '欢迎回来' : '开始使用'}</div><h2>{authMode === 'login' ? '登录你的账号' : '创建一个账号'}</h2><p className="intro">{authMode === 'login' ? '登录后进入你的短链工作空间。' : '注册后可以创建工作空间并邀请团队成员。'}</p>{authMode === 'register' && <label>姓名 <span className="optional">选填</span><input name="name" maxLength={100} placeholder="怎么称呼你" /></label>}<label>邮箱<input type="email" name="email" autoComplete="email" required placeholder="you@company.com" /></label><label>密码<input type="password" name="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required placeholder="至少 8 位字符" /></label><details className="api-config"><summary>后端 API 地址</summary><input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} aria-label="后端 API 地址" /></details>{error && <div className="message error-message">{error}</div>}{notice && <div className="message success-message">{notice}</div>}<button className="primary-button submit-button" disabled={busy}>{busy ? '请稍候…' : authMode === 'login' ? '登录工作空间' : '注册并登录'}<span>→</span></button><div className="auth-toggle">{authMode === 'login' ? '还没有账号？' : '已经有账号？'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>{authMode === 'login' ? '立即注册' : '返回登录'}</button></div></form><div className="secure-note"><span>●</span> 安全认证 · 团队专属空间</div></section>
  </main>

  return <div className="workspace-app"><aside className="side-rail"><div className="brand side-brand"><span className="brand-icon">↗</span><span>短链工场</span></div><div className="side-caption">工作台</div><div className="side-nav"><button className="nav-link active"><span>◫</span> 工作空间</button><button className="nav-link muted-nav" disabled><span>↗</span> 短链管理 <small>即将开放</small></button><button className="nav-link muted-nav" disabled><span>⌁</span> 访问分析 <small>即将开放</small></button><button className="nav-link muted-nav" disabled><span>♧</span> 成员与权限 <small>即将开放</small></button><button className="nav-link muted-nav" disabled><span>◷</span> 审计日志 <small>即将开放</small></button></div><div className="side-bottom"><div className="workspace-tip"><div className="tip-icon">✳</div><strong>为团队创建空间</strong><p>在工作空间中集中管理链接和协作者。</p><button onClick={() => setShowWorkspaceForm(true)}>创建工作空间 →</button></div><div className="account-row"><div className="avatar">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</div><div className="account-copy"><strong>{user?.name || '用户'}</strong><span>{user?.email}</span></div><button className="signout" title="退出登录" onClick={() => void signOut()}>↪</button></div></div></aside>
    <main className="workspace-main"><header className="top-header"><div className="crumb"><span>短链工场</span><i>/</i><strong>工作空间</strong></div><div className="header-right"><span className="connection"><i /> 已连接</span><div className="header-avatar">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</div></div></header><section className="main-content"><div className="page-title"><div><span className="overline">YOUR ORGANIZATION</span><h1>工作空间</h1><p>选择一个空间继续工作，或创建新的团队空间。</p></div><button className="primary-button" onClick={() => setShowWorkspaceForm(true)}>＋ 创建工作空间</button></div>{error && <div className="message error-message page-message">{error}<button onClick={() => setError('')}>×</button></div>}{notice && <div className="message success-message page-message">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <div className="welcome-strip"><div className="welcome-mark">✦</div><div><strong>你好，{user?.name || user?.email.split('@')[0] || '欢迎回来'}</strong><p>你的团队空间和短链将在这里汇集。</p></div><div className="welcome-decoration">↗</div></div>
      <div className="section-heading"><div><h2>你的工作空间</h2><p>{workspaces.length} 个空间 · 你可以按团队或项目组织链接</p></div></div>
      {workspaces.length ? <div className="workspace-grid">{workspaces.map((item) => <button key={item.id} className={`workspace-card ${selectedId === item.id ? 'chosen' : ''}`} onClick={() => setSelectedId(item.id)}><div className="workspace-card-head"><span className="workspace-tile">{item.name.slice(0, 1).toUpperCase()}</span><span className="card-arrow">↗</span></div><h3>{item.name}</h3><div className="slug-line"><span>⌗</span>{item.slug}</div><div className="workspace-card-foot"><div className="role-summary"><span className="role-dot" />{item.roles.map(formatRole).join(' · ') || '成员'}</div><span className="selected-label">{selectedId === item.id ? '当前空间' : '进入空间'} →</span></div></button>)}<button className="workspace-create-card" onClick={() => setShowWorkspaceForm(true)}><span>＋</span><strong>创建新工作空间</strong><small>为另一个团队或项目创建独立空间</small></button></div> : <div className="empty-workspaces"><div className="empty-symbol">⌂</div><h3>还没有工作空间</h3><p>创建一个空间，用来管理你的短链和团队协作者。</p><button className="primary-button" onClick={() => setShowWorkspaceForm(true)}>创建第一个工作空间</button></div>}
      {selected && <section className="selected-space"><div className="selected-space-icon">{selected.name.slice(0, 1).toUpperCase()}</div><div className="selected-space-copy"><span className="overline">SELECTED WORKSPACE</span><strong>{selected.name}</strong><p>标识：{selected.slug}　·　角色：{selected.roles.map(formatRole).join('、') || '成员'}</p></div><span className="selected-check">✓</span></section>}
      <footer className="main-footer"><span>SHORTLINK WORKSPACE</span><span>安全分享，清晰掌控</span></footer>
    </section></main>
    {showWorkspaceForm && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWorkspaceForm(false) }}><section className="dialog"><div className="dialog-head"><div><span className="overline">NEW WORKSPACE</span><h2>创建工作空间</h2></div><button className="close-dialog" onClick={() => setShowWorkspaceForm(false)}>×</button></div><p className="dialog-description">工作空间可按团队或项目划分，成员和短链数据彼此独立。</p><form onSubmit={createWorkspace}><label>空间名称<input name="name" required maxLength={100} placeholder="例如：增长营销团队" /></label><label>空间标识<input name="slug" required minLength={3} maxLength={50} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="growth-team" /><small>3–50 位小写字母、数字和连字符</small></label>{error && <div className="message error-message">{error}</div>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setShowWorkspaceForm(false)}>取消</button><button className="primary-button" disabled={busy}>{busy ? '正在创建…' : '创建空间'}</button></div></form></section></div>}
  </div>
}

function formatRole(role: string) { return ({ OWNER: '所有者', ADMIN: '管理员', MEMBER: '成员' } as Record<string, string>)[role] || role }

export default App
