import type { SharedUser, ShortLink, Workspace } from './types'

type Props = {
  workspace: Workspace | null
  links: ShortLink[]
  total: number
  totalPages: number
  page: number
  setPage: (page: number | ((current: number) => number)) => void
  loading: boolean
  search: string
  setSearch: (value: string) => void
  onRefresh: () => void
  onCreate: () => void
  onEdit: (link: ShortLink) => void
  onShare: (link: ShortLink) => void
  onToggle: (link: ShortLink) => void
  onDelete: (link: ShortLink) => void
  dialog: ShortLink | 'new' | null
  setDialog: (dialog: ShortLink | 'new' | null) => void
  onSave: (event: React.FormEvent<HTMLFormElement>) => void
  busy: boolean
  error: string
  setError: (error: string) => void
  sharedLink: ShortLink | null
  setSharedLink: (link: ShortLink | null) => void
  sharedUsers: SharedUser[]
  shareLoading: boolean
  onGrant: (event: React.FormEvent<HTMLFormElement>) => void
  onRevoke: (user: SharedUser) => void
}

export default function ShortLinksPage(props: Props) {
  const {
    workspace,
    links,
    total,
    totalPages,
    page,
    setPage,
    loading,
    search,
    setSearch,
    onRefresh,
    onCreate,
    onEdit,
    onShare,
    onToggle,
    onDelete,
    dialog,
    setDialog,
    onSave,
    busy,
    error,
    setError,
    sharedLink,
    setSharedLink,
    sharedUsers,
    shareLoading,
    onGrant,
    onRevoke,
  } = props
  const visibleLinks = links.filter((link) =>
    `${link.title || ''} ${link.code} ${link.originalUrl}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  return (
    <>
      <section className="main-content links-content">
        <div className="page-title">
          <div>
            <span className="overline">LINK MANAGEMENT</span>
            <h1>短链管理</h1>
            <p>
              {workspace
                ? `管理「${workspace.name}」中的短链接、访问权限与有效期。`
                : '先选择或创建一个工作空间来管理短链。'}
            </p>
          </div>
          <button className="primary-button" disabled={!workspace} onClick={onCreate}>
            ＋ 创建短链
          </button>
        </div>
        {error && (
          <div className="message error-message page-message">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}
        {!workspace ? (
          <div className="empty-workspaces">
            <div className="empty-symbol">⌂</div>
            <h3>选择一个工作空间</h3>
            <p>短链属于工作空间，请先创建或选择工作空间。</p>
          </div>
        ) : (
          <>
            <div className="links-summary">
              <div className="summary-total">
                <strong>{total}</strong>
                <span>条短链</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-active">
                <i />
                本页 {links.filter((link) => link.status === 'ACTIVE').length} 条启用
              </div>
              <div className="links-search">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索标题、短码或目标网址"
                />
              </div>
            </div>
            <div className="links-panel">
              <div className="links-panel-heading">
                <div>
                  <h2>全部短链</h2>
                  <p>按创建时间倒序排列</p>
                </div>
                <button
                  className="refresh-button"
                  disabled={loading}
                  onClick={onRefresh}
                  title="刷新列表"
                >
                  ⟳ 刷新
                </button>
              </div>
              <div className="links-table-wrap">
                <table className="links-table">
                  <thead>
                    <tr>
                      <th>短链</th>
                      <th>目标网址</th>
                      <th>访问权限</th>
                      <th>状态</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="links-empty">
                            <span className="loading-spinner" />
                            正在加载短链…
                          </div>
                        </td>
                      </tr>
                    ) : (
                      visibleLinks.map((link) => (
                        <tr key={link.id}>
                          <td>
                            <div className="shortlink-main">
                              <span className="shortlink-symbol">↗</span>
                              <div>
                                <strong>{link.title || link.code}</strong>
                                <button
                                  className="short-url"
                                  onClick={() => void copyShortUrl(link.shortUrl, setError)}
                                >
                                  {link.shortUrl}
                                  <span>▢</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <a
                              className="target-url"
                              href={link.originalUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={link.originalUrl}
                            >
                              {link.originalUrl}
                            </a>
                          </td>
                          <td>
                            <span
                              className={`visibility-tag visibility-${link.visibility.toLowerCase()}`}
                            >
                              <i />
                              {visibilityName(link.visibility)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`link-state ${link.status === 'ACTIVE' ? 'enabled' : 'disabled'}`}
                            >
                              <i />
                              {link.status === 'ACTIVE' ? '启用中' : '已停用'}
                            </span>
                          </td>
                          <td className="created-at">{formatDate(link.createdAt)}</td>
                          <td>
                            <div className="link-actions">
                              <button title="共享成员" onClick={() => onShare(link)}>
                                ♙
                              </button>
                              <button title="编辑短链" onClick={() => onEdit(link)}>
                                ✎
                              </button>
                              <button
                                title={link.status === 'ACTIVE' ? '停用' : '启用'}
                                onClick={() => onToggle(link)}
                              >
                                {link.status === 'ACTIVE' ? 'Ⅱ' : '▶'}
                              </button>
                              <button
                                title="删除短链"
                                className="delete-action"
                                onClick={() => onDelete(link)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    {!loading && visibleLinks.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="links-empty">
                            <span className="empty-link-icon">↗</span>
                            <strong>{search ? '没有匹配的短链' : '这里还没有短链'}</strong>
                            <p>
                              {search
                                ? '换一个标题、短码或网址试试。'
                                : '创建第一条短链，开始管理分享与访问。'}
                            </p>
                            {!search && (
                              <button className="primary-button" onClick={onCreate}>
                                ＋ 创建短链
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  共 {total} 条 · 第 {page} / {totalPages} 页
                </span>
                <div>
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    ← 上一页
                  </button>
                  <button
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    下一页 →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
      {dialog && (
        <div
          className="modal-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setDialog(null)
          }}
        >
          <section className="dialog wide-dialog">
            <div className="dialog-head">
              <div>
                <span className="overline">SHORT LINK</span>
                <h2>{dialog === 'new' ? '创建短链' : '编辑短链'}</h2>
              </div>
              <button className="close-dialog" disabled={busy} onClick={() => setDialog(null)}>
                ×
              </button>
            </div>
            <p className="dialog-description">
              设置目标网址、访问范围和有效期。创建后可以在列表中管理链接状态。
            </p>
            <form onSubmit={onSave}>
              <label>
                目标网址
                <input
                  name="originalUrl"
                  type="url"
                  required
                  defaultValue={dialog === 'new' ? '' : dialog.originalUrl}
                  placeholder="https://example.com/campaign"
                />
              </label>
              <label>
                短链标题 <span className="optional">选填</span>
                <input
                  name="title"
                  maxLength={200}
                  defaultValue={dialog === 'new' ? '' : dialog.title || ''}
                  placeholder="例如：秋季产品发布"
                />
              </label>
              <div className="dialog-form-row">
                <label>
                  访问范围
                  <select
                    name="visibility"
                    defaultValue={dialog === 'new' ? 'PUBLIC' : dialog.visibility}
                  >
                    <option value="PUBLIC">公开访问</option>
                    <option value="WORKSPACE">仅工作空间成员</option>
                    <option value="PRIVATE">仅创建者</option>
                    <option value="PASSWORD">密码保护</option>
                  </select>
                </label>
                <label>
                  最大访问次数 <span className="optional">选填</span>
                  <input
                    name="maxVisits"
                    type="number"
                    min="1"
                    defaultValue={dialog === 'new' ? '' : dialog.maxVisits || ''}
                    placeholder="不限制"
                  />
                </label>
              </div>
              <label>
                密码保护密码{' '}
                {dialog !== 'new' && <span className="optional">留空则保留原密码</span>}
                <input
                  name="password"
                  type="password"
                  minLength={6}
                  maxLength={128}
                  placeholder={
                    dialog === 'new'
                      ? '当访问范围设为密码保护时必填（至少 6 位）'
                      : '设置密码保护时输入新密码'
                  }
                />
              </label>
              <label>
                到期时间 <span className="optional">选填</span>
                <input
                  name="expiresAt"
                  type="datetime-local"
                  defaultValue={
                    dialog === 'new' || !dialog.expiresAt ? '' : toLocalDatetime(dialog.expiresAt)
                  }
                />
              </label>
              {error && <div className="message error-message">{error}</div>}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  取消
                </button>
                <button className="primary-button" disabled={busy}>
                  {busy ? '正在保存…' : dialog === 'new' ? '创建短链' : '保存修改'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {sharedLink && (
        <div
          className="modal-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setSharedLink(null)
          }}
        >
          <section className="dialog share-dialog">
            <div className="dialog-head">
              <div>
                <span className="overline">LINK SHARING</span>
                <h2>共享成员</h2>
              </div>
              <button className="close-dialog" disabled={busy} onClick={() => setSharedLink(null)}>
                ×
              </button>
            </div>
            <p className="dialog-description">
              为「{sharedLink.title || sharedLink.code}
              」添加允许访问的账号。添加对象需要先注册平台账号。
            </p>
            <form className="grant-form" onSubmit={onGrant}>
              <input name="email" type="email" required placeholder="输入成员邮箱" />
              <button className="primary-button" disabled={busy}>
                添加
              </button>
            </form>
            {error && <div className="message error-message">{error}</div>}
            <div className="shared-users-heading">
              <strong>已授权成员</strong>
              <span>{sharedUsers.length}</span>
            </div>
            <div className="shared-users-list">
              {shareLoading ? (
                <div className="share-empty">正在加载共享成员…</div>
              ) : (
                sharedUsers.map((user) => (
                  <div className="shared-user-row" key={user.id}>
                    <span className="shared-avatar">
                      {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="shared-user-copy">
                      <strong>{user.name || user.email}</strong>
                      <small>{user.email}</small>
                    </span>
                    <button title="撤销访问" onClick={() => onRevoke(user)}>
                      撤销
                    </button>
                  </div>
                ))
              )}
              {!shareLoading && !sharedUsers.length && (
                <div className="share-empty">尚未授权其他成员访问此短链。</div>
              )}
            </div>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setSharedLink(null)}>
                完成
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

async function copyShortUrl(url: string, setError: (error: string) => void) {
  try {
    if (navigator.clipboard) await navigator.clipboard.writeText(url)
    else {
      const input = document.createElement('textarea')
      input.value = url
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      const copied = document.execCommand('copy')
      input.remove()
      if (!copied) throw new Error('复制失败，请手动复制短链地址。')
    }
    window.dispatchEvent(new Event('shortlink:copied'))
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : '复制失败，请手动复制短链地址。')
  }
}
function visibilityName(visibility: ShortLink['visibility']) {
  return (
    { PUBLIC: '公开', WORKSPACE: '工作空间', PRIVATE: '私有', PASSWORD: '密码保护' } as const
  )[visibility]
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}
function toLocalDatetime(value: string) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
