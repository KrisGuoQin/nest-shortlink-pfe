import type { User, Workspace } from './types'

type Props = {
  workspaces: Workspace[]
  selectedId: string
  setSelectedId: (id: string) => void
  user: User | null
  onCreateWorkspace: () => void
  showCreateForm: boolean
  setShowCreateForm: (show: boolean) => void
  busy: boolean
  error: string
  setError: (error: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export default function WorkspacesPage({
  workspaces,
  selectedId,
  setSelectedId,
  user,
  onCreateWorkspace,
  showCreateForm,
  setShowCreateForm,
  busy,
  error,
  setError,
  onSubmit,
}: Props) {
  const selected = workspaces.find((item) => item.id === selectedId) || null
  return (
    <>
      <section className="main-content">
        <div className="page-title">
          <div>
            <span className="overline">YOUR ORGANIZATION</span>
            <h1>工作空间</h1>
            <p>选择一个空间继续工作，或创建新的团队空间。</p>
          </div>
          <button className="primary-button" onClick={onCreateWorkspace}>
            ＋ 创建工作空间
          </button>
        </div>
        {error && (
          <div className="message error-message page-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}
        <div className="welcome-strip">
          <div className="welcome-mark">✦</div>
          <div>
            <strong>你好，{user?.name || user?.email.split('@')[0] || '欢迎回来'}</strong>
            <p>你的团队空间和短链将在这里汇集。</p>
          </div>
          <div className="welcome-decoration">↗</div>
        </div>
        <div className="section-heading">
          <div>
            <h2>你的工作空间</h2>
            <p>{workspaces.length} 个空间 · 你可以按团队或项目组织链接</p>
          </div>
        </div>
        {workspaces.length ? (
          <div className="workspace-grid">
            {workspaces.map((item) => (
              <button
                key={item.id}
                className={`workspace-card ${selectedId === item.id ? 'chosen' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="workspace-card-head">
                  <span className="workspace-tile">{item.name.slice(0, 1).toUpperCase()}</span>
                  <span className="card-arrow">↗</span>
                </div>
                <h3>{item.name}</h3>
                <div className="slug-line">
                  <span>⌗</span>
                  {item.slug}
                </div>
                <div className="workspace-card-foot">
                  <div className="role-summary">
                    <span className="role-dot" />
                    {item.roles.map(formatRole).join(' · ') || '成员'}
                  </div>
                  <span className="selected-label">
                    {selectedId === item.id ? '当前空间' : '选择此空间'} →
                  </span>
                </div>
              </button>
            ))}
            <button className="workspace-create-card" onClick={onCreateWorkspace}>
              <span>＋</span>
              <strong>创建新工作空间</strong>
              <small>为另一个团队或项目创建独立空间</small>
            </button>
          </div>
        ) : (
          <div className="empty-workspaces">
            <div className="empty-symbol">⌂</div>
            <h3>还没有工作空间</h3>
            <p>创建一个空间，用来管理你的短链和团队协作者。</p>
            <button className="primary-button" onClick={onCreateWorkspace}>
              创建第一个工作空间
            </button>
          </div>
        )}
        {selected && (
          <section className="selected-space">
            <div className="selected-space-icon">{selected.name.slice(0, 1).toUpperCase()}</div>
            <div className="selected-space-copy">
              <span className="overline">SELECTED WORKSPACE</span>
              <strong>{selected.name}</strong>
              <p>
                标识：{selected.slug}　·　角色：
                {selected.roles.map(formatRole).join('、') || '成员'}
              </p>
            </div>
            <span className="selected-check">✓</span>
          </section>
        )}
        <footer className="main-footer">
          <span>SHORTLINK WORKSPACE</span>
          <span>安全分享，清晰掌控</span>
        </footer>
      </section>
      {showCreateForm && (
        <div
          className="modal-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreateForm(false)
          }}
        >
          <section className="dialog">
            <div className="dialog-head">
              <div>
                <span className="overline">NEW WORKSPACE</span>
                <h2>创建工作空间</h2>
              </div>
              <button className="close-dialog" onClick={() => setShowCreateForm(false)}>
                ×
              </button>
            </div>
            <p className="dialog-description">
              工作空间可按团队或项目划分，成员和短链数据彼此独立。
            </p>
            <form onSubmit={onSubmit}>
              <label>
                空间名称
                <input name="name" required maxLength={100} placeholder="例如：增长营销团队" />
              </label>
              <label>
                空间标识
                <input
                  name="slug"
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="growth-team"
                />
                <small>3–50 位小写字母、数字和连字符</small>
              </label>
              {error && <div className="message error-message">{error}</div>}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateForm(false)}
                >
                  取消
                </button>
                <button className="primary-button" disabled={busy}>
                  {busy ? '正在创建…' : '创建空间'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

function formatRole(role: string) {
  return (
    ({ OWNER: '所有者', ADMIN: '管理员', MEMBER: '成员' } as Record<string, string>)[role] || role
  )
}
