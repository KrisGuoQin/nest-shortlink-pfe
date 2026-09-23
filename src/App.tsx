import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { ShortLink, SharedUser, User, Workspace } from './pages/types'
import './App.css'

const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage'))
const ShortLinksPage = lazy(() => import('./pages/ShortLinksPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const AccessLoginPage = lazy(() => import('./pages/AccessLoginPage'))
const AccessPasswordPage = lazy(() => import('./pages/AccessPasswordPage'))

type Session = { accessToken: string; refreshToken: string }
type Module = 'spaces' | 'links' | 'analytics' | 'members' | 'audit'
type MembershipResponse = { workspace: Omit<Workspace, 'roles'>; roles: string[] }
type SharedUserResponse = { createdAt: string; user: SharedUser }
const SESSION_KEY = 'shortlink-session'
const API_KEY = 'shortlink-api'

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null
  } catch {
    return null
  }
}

function modulePath(module: Module, workspaceId: string) {
  return module === 'spaces' || !workspaceId
    ? '/workspaces'
    : `/workspaces/${encodeURIComponent(workspaceId)}/${module}`
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/access/login"
          element={
            <Suspense
              fallback={
                <main className="access-shell">
                  <div className="access-card">正在加载…</div>
                </main>
              }
            >
              <AccessLoginPage />
            </Suspense>
          }
        />
        <Route
          path="/access/password/:code"
          element={
            <Suspense
              fallback={
                <main className="access-shell">
                  <div className="access-card">正在加载…</div>
                </main>
              }
            >
              <AccessPasswordPage />
            </Suspense>
          }
        />
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/workspaces" element={<WorkspaceRoute module="spaces" />} />
        <Route path="/workspaces/:workspaceId/links" element={<WorkspaceRoute module="links" />} />
        <Route
          path="/workspaces/:workspaceId/analytics"
          element={<WorkspaceRoute module="analytics" />}
        />
        <Route
          path="/workspaces/:workspaceId/members"
          element={<WorkspaceRoute module="members" />}
        />
        <Route path="/workspaces/:workspaceId/audit" element={<WorkspaceRoute module="audit" />} />
        <Route path="*" element={<Navigate to="/workspaces" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function WorkspaceRoute({ module }: { module: Module }) {
  const { workspaceId = '' } = useParams()
  return <WorkspaceApp module={module} routeWorkspaceId={workspaceId} />
}

function WorkspaceApp({ module, routeWorkspaceId }: { module: Module; routeWorkspaceId: string }) {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(readSession)
  const [apiUrl, setApiUrl] = useState(localStorage.getItem(API_KEY) || '/api')
  const [user, setUser] = useState<User | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedId, setSelectedId] = useState(routeWorkspaceId)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const refreshPromise = useRef<Promise<Session> | null>(null)

  const [links, setLinks] = useState<ShortLink[]>([])
  const [linksPage, setLinksPage] = useState(1)
  const [linksTotalPages, setLinksTotalPages] = useState(1)
  const [linksTotal, setLinksTotal] = useState(0)
  const [linksLoading, setLinksLoading] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkDialog, setLinkDialog] = useState<ShortLink | 'new' | null>(null)
  const [shareDialog, setShareDialog] = useState<ShortLink | null>(null)
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  const [shareLoading, setShareLoading] = useState(false)

  const goTo = useCallback(
    (nextModule: Module, workspaceId = selectedId) => {
      navigate(modulePath(nextModule, workspaceId))
      if (nextModule !== 'spaces' && workspaceId) setSelectedId(workspaceId)
    },
    [navigate, selectedId],
  )

  useEffect(() => {
    if (routeWorkspaceId) setSelectedId(routeWorkspaceId)
  }, [routeWorkspaceId])
  useEffect(() => {
    if (!notice) return
    const timeoutId = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [notice])
  useEffect(() => {
    const onCopied = () => setNotice('短链地址已复制到剪贴板。')
    window.addEventListener('shortlink:copied', onCopied)
    return () => window.removeEventListener('shortlink:copied', onCopied)
  }, [])

  const request = useCallback(
    async <T,>(
      path: string,
      options: RequestInit = {},
      token = session?.accessToken,
    ): Promise<T> => {
      const send = (accessToken?: string) => {
        const headers = new Headers(options.headers)
        if (options.body && !headers.has('Content-Type'))
          headers.set('Content-Type', 'application/json')
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
        else headers.delete('Authorization')
        return fetch(`${apiUrl.replace(/\/$/, '')}${path}`, { ...options, headers })
      }
      let response = await send(token)
      const publicAuthPath = ['/auth/login', '/auth/register', '/auth/refresh'].includes(path)
      if (response.status === 401 && session?.refreshToken && !publicAuthPath) {
        try {
          if (!refreshPromise.current) {
            refreshPromise.current = fetch(`${apiUrl.replace(/\/$/, '')}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: session.refreshToken }),
            })
              .then(async (res) => {
                if (!res.ok) throw new Error('Session expired')
                return (await res.json()) as Session
              })
              .then((refreshed) => {
                localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed))
                setSession(refreshed)
                return refreshed
              })
              .catch((cause: unknown) => {
                localStorage.removeItem(SESSION_KEY)
                setSession(null)
                setUser(null)
                setWorkspaces([])
                setSelectedId('')
                throw cause
              })
              .finally(() => {
                refreshPromise.current = null
              })
          }
          const refreshed = await refreshPromise.current
          response = await send(refreshed.accessToken)
        } catch {
          throw new Error('登录状态已过期，请重新登录。')
        }
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string | string[]
        } | null
        const message = Array.isArray(payload?.message)
          ? payload.message.join('；')
          : payload?.message
        throw new Error(message || `请求失败 (${response.status})`)
      }
      if (response.status === 204) return undefined as T
      return response.json() as Promise<T>
    },
    [apiUrl, session?.accessToken, session?.refreshToken],
  )

  const loadAccount = useCallback(async () => {
    if (!session) return
    try {
      const [me, memberships] = await Promise.all([
        request<User>('/auth/me'),
        request<MembershipResponse[]>('/workspaces'),
      ])
      const items = memberships.map(({ workspace, roles }) => ({ ...workspace, roles }))
      setUser(me)
      setWorkspaces(items)
      setSelectedId((current) =>
        items.some((item) => item.id === current) ? current : items[0]?.id || '',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法载入账号信息')
    }
  }, [request, session])
  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  const loadLinks = useCallback(async () => {
    if (!selectedId) return
    setLinksLoading(true)
    setError('')
    try {
      const result = await request<{
        data: ShortLink[]
        pagination: { total: number; totalPages: number }
      }>(`/workspaces/${selectedId}/links?page=${linksPage}&pageSize=20`)
      setLinks(result.data)
      setLinksTotal(result.pagination.total)
      setLinksTotalPages(Math.max(1, result.pagination.totalPages))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法加载短链列表')
    } finally {
      setLinksLoading(false)
    }
  }, [linksPage, request, selectedId])
  useEffect(() => {
    if (module === 'links') void loadLinks()
  }, [module, loadLinks])

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    try {
      localStorage.setItem(API_KEY, apiUrl)
      if (authMode === 'register')
        await request(
          '/auth/register',
          {
            method: 'POST',
            body: JSON.stringify({ email, password, name: form.get('name') || undefined }),
          },
          undefined,
        )
      const result = await request<Session>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
        undefined,
      )
      localStorage.setItem(SESSION_KEY, JSON.stringify(result))
      setSession(result)
      navigate('/workspaces')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await request('/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          slug: String(form.get('slug')).trim().toLowerCase(),
        }),
      })
      setShowWorkspaceForm(false)
      setNotice('工作空间已创建。')
      await loadAccount()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建工作空间失败。')
    } finally {
      setBusy(false)
    }
  }

  async function saveLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return
    const form = new FormData(event.currentTarget)
    const visibility = String(form.get('visibility')) as ShortLink['visibility']
    const password = String(form.get('password') || '')
    if (
      visibility === 'PASSWORD' &&
      ((password.length > 0 && password.length < 6) ||
        (!password && (linkDialog === 'new' || linkDialog?.visibility !== 'PASSWORD')))
    ) {
      setError('密码保护需要设置至少 6 位密码。')
      return
    }
    setBusy(true)
    setError('')
    const expiresLocal = String(form.get('expiresAt') || '')
    const body: Record<string, unknown> = {
      originalUrl: String(form.get('originalUrl')).trim(),
      title: String(form.get('title') || '').trim() || undefined,
      maxVisits: form.get('maxVisits') ? Number(form.get('maxVisits')) : undefined,
      expiresAt: expiresLocal ? new Date(expiresLocal).toISOString() : undefined,
    }
    try {
      if (linkDialog === 'new') {
        const created = await request<ShortLink>(`/workspaces/${selectedId}/links`, {
          method: 'POST',
          body: JSON.stringify({
            ...body,
            visibility: visibility === 'PASSWORD' ? 'PUBLIC' : visibility,
          }),
        })
        if (visibility === 'PASSWORD')
          await request(`/workspaces/${selectedId}/links/${created.id}/access`, {
            method: 'PATCH',
            body: JSON.stringify({ visibility, password }),
          })
      } else if (linkDialog) {
        await request(`/workspaces/${selectedId}/links/${linkDialog.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        await request(`/workspaces/${selectedId}/links/${linkDialog.id}/access`, {
          method: 'PATCH',
          body: JSON.stringify({ visibility, ...(password ? { password } : {}) }),
        })
      }
      setLinkDialog(null)
      setNotice(linkDialog === 'new' ? '短链创建成功。' : '短链已更新。')
      await loadLinks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存短链失败')
    } finally {
      setBusy(false)
    }
  }

  async function toggleLink(link: ShortLink) {
    try {
      await request(`/workspaces/${selectedId}/links/${link.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: link.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }),
      })
      setNotice(link.status === 'ACTIVE' ? '短链已停用。' : '短链已启用。')
      await loadLinks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新短链状态失败')
    }
  }
  async function deleteLink(link: ShortLink) {
    if (!window.confirm(`确定删除「${link.title || link.code}」？此操作无法撤销。`)) return
    try {
      await request(`/workspaces/${selectedId}/links/${link.id}`, { method: 'DELETE' })
      setNotice('短链已删除。')
      if (links.length === 1 && linksPage > 1) setLinksPage(linksPage - 1)
      else await loadLinks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除短链失败')
    }
  }
  async function openShare(link: ShortLink) {
    setShareDialog(link)
    setSharedUsers([])
    setShareLoading(true)
    setError('')
    try {
      const result = await request<SharedUserResponse[]>(
        `/workspaces/${selectedId}/links/${link.id}/share-users`,
      )
      setSharedUsers(result.map((item) => item.user))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取共享成员失败')
    } finally {
      setShareLoading(false)
    }
  }
  async function grantShareUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!shareDialog) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const sharedUser = await request<SharedUser>(
        `/workspaces/${selectedId}/links/${shareDialog.id}/share-users`,
        { method: 'POST', body: JSON.stringify({ email: form.get('email') }) },
      )
      setSharedUsers((items) =>
        items.some((item) => item.id === sharedUser.id) ? items : [...items, sharedUser],
      )
      event.currentTarget.reset()
      setNotice('共享成员已添加。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '添加共享成员失败')
    } finally {
      setBusy(false)
    }
  }
  async function revokeShareUser(sharedUser: SharedUser) {
    if (!shareDialog) return
    try {
      await request(
        `/workspaces/${selectedId}/links/${shareDialog.id}/share-users/${sharedUser.id}`,
        { method: 'DELETE' },
      )
      setSharedUsers((items) => items.filter((item) => item.id !== sharedUser.id))
      setNotice('共享访问已撤销。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '撤销访问失败')
    }
  }
  async function signOut() {
    try {
      await request('/auth/logout', { method: 'POST' })
    } catch {
      /* Local sign-out still applies when the network is unavailable. */
    }
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setUser(null)
    setWorkspaces([])
    setSelectedId('')
    setNotice('')
  }

  const selected = workspaces.find((item) => item.id === selectedId) || null
  const moduleName: Record<Module, string> = {
    spaces: '工作空间',
    links: '短链管理',
    analytics: '访问分析',
    members: '成员与权限',
    audit: '审计日志',
  }

  if (!session)
    return (
      <main className="auth-layout">
        <section className="auth-art">
          <div className="brand">
            <span className="brand-icon">↗</span> 短链工场
          </div>
          <div className="art-copy">
            <span className="overline">SHORTLINK WORKSPACE</span>
            <h1>
              让每一次分享
              <br />
              都有清晰的回响。
            </h1>
            <p>管理短链接、协作权限与访问数据，让团队分享更简单、更安全。</p>
            <div className="art-graphic">
              <div className="graphic-ring ring-one" />
              <div className="graphic-ring ring-two" />
              <div className="graphic-center">↗</div>
              <span className="graphic-node node-one">LINK</span>
              <span className="graphic-node node-two">DATA</span>
              <span className="graphic-node node-three">TEAM</span>
            </div>
          </div>
          <div className="art-foot">链接管理 · 团队协作 · 数据洞察</div>
        </section>
        <section className="auth-content">
          <form className="auth-form" onSubmit={submitAuth}>
            <div className="form-kicker">{authMode === 'login' ? '欢迎回来' : '开始使用'}</div>
            <h2>{authMode === 'login' ? '登录你的账号' : '创建一个账号'}</h2>
            <p className="intro">
              {authMode === 'login'
                ? '登录后进入你的短链工作空间。'
                : '注册后可以创建工作空间并邀请团队成员。'}
            </p>
            {authMode === 'register' && (
              <label>
                姓名 <span className="optional">选填</span>
                <input name="name" maxLength={100} placeholder="怎么称呼你" />
              </label>
            )}
            <label>
              邮箱
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                name="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                maxLength={128}
                required
                placeholder="至少 8 位字符"
              />
            </label>
            <details className="api-config">
              <summary>后端 API 地址</summary>
              <input
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
                aria-label="后端 API 地址"
              />
            </details>
            {error && <div className="message error-message">{error}</div>}
            <button className="primary-button submit-button" disabled={busy}>
              {busy ? '请稍候…' : authMode === 'login' ? '登录工作空间' : '注册并登录'}
              <span>→</span>
            </button>
            <div className="auth-toggle">
              {authMode === 'login' ? '还没有账号？' : '已经有账号？'}{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login')
                  setError('')
                }}
              >
                {authMode === 'login' ? '立即注册' : '返回登录'}
              </button>
            </div>
          </form>
        </section>
      </main>
    )

  return (
    <div className="workspace-app">
      <aside className="side-rail">
        <div className="brand side-brand">
          <span className="brand-icon">↗</span>
          <span>短链工场</span>
        </div>
        <div className="workspace-nav-picker">
          <span className="workspace-mini-icon">
            {selected?.name.slice(0, 1).toUpperCase() || 'W'}
          </span>
          <select
            aria-label="当前工作空间"
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setLinksPage(1)
              if (module !== 'spaces') goTo(module, event.target.value)
            }}
          >
            <option value="" disabled>
              选择工作空间
            </option>
            {workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="side-caption">工作台</div>
        <nav className="side-nav">
          {(
            [
              { id: 'spaces', icon: '◫' },
              { id: 'links', icon: '↗' },
              { id: 'analytics', icon: '⌁' },
              { id: 'members', icon: '♧' },
              { id: 'audit', icon: '◷' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-link ${module === item.id ? 'active' : ''}`}
              onClick={() => {
                goTo(item.id)
                if (item.id === 'links') setLinksPage(1)
              }}
            >
              <span>{item.icon}</span>
              {moduleName[item.id]}
              {item.id === 'links' && linksTotal > 0 && (
                <small className="nav-total">{linksTotal}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="workspace-tip">
            <div className="tip-icon">✳</div>
            <strong>为团队创建空间</strong>
            <p>在工作空间中集中管理链接和协作者。</p>
            <button onClick={() => setShowWorkspaceForm(true)}>创建工作空间 →</button>
          </div>
          <div className="account-row">
            <div className="avatar">
              {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="account-copy">
              <strong>{user?.name || '用户'}</strong>
              <span>{user?.email}</span>
            </div>
            <button className="signout" title="退出登录" onClick={() => void signOut()}>
              ↪
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="top-header">
          <div className="crumb">
            <span>{selected?.name || '短链工场'}</span>
            <i>/</i>
            <strong>{moduleName[module]}</strong>
          </div>
          <div className="header-right">
            <span className="connection">
              <i /> 已连接
            </span>
            <div className="header-avatar">
              {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        {notice && (
          <div className="global-notice">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}
        <Suspense
          fallback={
            <section className="main-content module-loading">
              <span className="loading-spinner" />
              正在加载模块…
            </section>
          }
        >
          {module === 'spaces' && (
            <WorkspacesPage
              workspaces={workspaces}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              user={user}
              onCreateWorkspace={() => setShowWorkspaceForm(true)}
              showCreateForm={showWorkspaceForm}
              setShowCreateForm={setShowWorkspaceForm}
              busy={busy}
              error={error}
              setError={setError}
              onSubmit={createWorkspace}
            />
          )}
          {module === 'links' && (
            <ShortLinksPage
              workspace={selected}
              links={links}
              total={linksTotal}
              totalPages={linksTotalPages}
              page={linksPage}
              setPage={setLinksPage}
              loading={linksLoading}
              search={linkSearch}
              setSearch={setLinkSearch}
              onRefresh={() => void loadLinks()}
              onCreate={() => setLinkDialog('new')}
              onEdit={setLinkDialog}
              onShare={(link) => void openShare(link)}
              onToggle={(link) => void toggleLink(link)}
              onDelete={(link) => void deleteLink(link)}
              dialog={linkDialog}
              setDialog={setLinkDialog}
              onSave={saveLink}
              busy={busy}
              error={error}
              setError={setError}
              sharedLink={shareDialog}
              setSharedLink={setShareDialog}
              sharedUsers={sharedUsers}
              shareLoading={shareLoading}
              onGrant={grantShareUser}
              onRevoke={(sharedUser) => void revokeShareUser(sharedUser)}
            />
          )}
          {module === 'analytics' && <AnalyticsPage workspace={selected} request={request} />}
          {module === 'members' && (
            <MembersPage workspace={selected} request={request} onNotice={setNotice} />
          )}
          {module === 'audit' && <AuditPage workspace={selected} request={request} />}
        </Suspense>
      </main>
    </div>
  )
}
