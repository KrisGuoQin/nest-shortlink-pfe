import { useCallback, useEffect, useState } from 'react'
import type { ApiRequest, Workspace, WorkspaceMember } from './types'

type Props = {
  workspace: Workspace | null
  request: ApiRequest
  onNotice: (message: string) => void
}
const roleLabels: Record<string, string> = { OWNER: '所有者', ADMIN: '管理员', MEMBER: '成员' }
const roleOptions = ['MEMBER', 'ADMIN', 'OWNER']

export default function MembersPage({ workspace, request, onNotice }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [roleByMember, setRoleByMember] = useState<Record<string, string>>({})
  const canManage = Boolean(workspace?.roles.some((role) => role === 'OWNER' || role === 'ADMIN'))

  const loadMembers = useCallback(async () => {
    if (!workspace) {
      setMembers([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await request<WorkspaceMember[]>(`/workspaces/${workspace.id}/members`)
      setMembers(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '成员列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [request, workspace])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspace) return
    setBusy(true)
    setError('')
    try {
      await request(`/workspaces/${workspace.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setEmail('')
      onNotice('成员已添加到工作空间。')
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '邀请成员失败')
    } finally {
      setBusy(false)
    }
  }

  async function addRole(member: WorkspaceMember) {
    if (!workspace) return
    const roleCode =
      roleByMember[member.id] ||
      roleOptions.find((role) => !member.roles.some((item) => item.role.code === role))
    if (!roleCode) return
    setBusy(true)
    setError('')
    try {
      await request(`/workspaces/${workspace.id}/members/${member.id}/role`, {
        method: 'POST',
        body: JSON.stringify({ roleCode }),
      })
      setRoleByMember((current) => {
        const next = { ...current }
        delete next[member.id]
        return next
      })
      onNotice(`已为 ${member.user.email} 追加${roleLabels[roleCode] || roleCode}角色。`)
      await loadMembers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '角色分配失败')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member: WorkspaceMember) {
    if (
      !workspace ||
      !window.confirm(`确定将 ${member.user.name || member.user.email} 移出此工作空间吗？`)
    )
      return
    setBusy(true)
    setError('')
    try {
      await request(`/workspaces/${workspace.id}/members/${member.id}`, { method: 'DELETE' })
      setMembers((current) => current.filter((item) => item.id !== member.id))
      onNotice('成员已从工作空间移除。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '移除成员失败')
    } finally {
      setBusy(false)
    }
  }

  if (!workspace)
    return (
      <section className="main-content">
        <div className="page-title">
          <div>
            <span className="overline">TEAM ACCESS</span>
            <h1>成员与权限</h1>
            <p>先选择一个工作空间来管理成员。</p>
          </div>
        </div>
        <div className="empty-workspaces">
          <div className="empty-symbol">♧</div>
          <h3>选择一个工作空间</h3>
          <p>成员和角色按工作空间分别管理。</p>
        </div>
      </section>
    )

  return (
    <section className="main-content members-content">
      <div className="page-title">
        <div>
          <span className="overline">TEAM ACCESS</span>
          <h1>成员与权限</h1>
          <p>管理「{workspace.name}」的成员，并查看他们在此空间中的角色。</p>
        </div>
        <button
          className="refresh-button"
          disabled={loading || busy}
          onClick={() => void loadMembers()}
        >
          ⟳ 刷新
        </button>
      </div>
      {error && (
        <div className="message error-message page-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      <div className="members-summary">
        <div className="members-summary-icon">♧</div>
        <div>
          <strong>{members.length}</strong>
          <span>位工作空间成员</span>
        </div>
        <small>成员需先注册平台账号后，才能通过邮箱添加。</small>
      </div>
      {canManage && (
        <section className="members-invite-panel">
          <div>
            <span className="overline">INVITE MEMBER</span>
            <h2>添加成员</h2>
            <p>输入已注册用户的邮箱，系统会自动赋予“成员”角色。</p>
          </div>
          <form onSubmit={(event) => void inviteMember(event)}>
            <input
              aria-label="成员邮箱"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
            <button className="primary-button" disabled={busy || !email.trim()}>
              {busy ? '请稍候…' : '＋ 添加成员'}
            </button>
          </form>
        </section>
      )}
      <section className="members-panel">
        <div className="links-panel-heading">
          <div>
            <h2>空间成员</h2>
            <p>按加入时间排列 · 角色权限会叠加生效</p>
          </div>
          <span className="members-count">{members.length} 人</span>
        </div>
        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>成员</th>
                <th>角色</th>
                <th>加入时间</th>
                {canManage && <th>管理</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3}>
                    <div className="links-empty">
                      <span className="loading-spinner" />
                      正在加载成员…
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const availableRoles = roleOptions.filter(
                    (role) => !member.roles.some((item) => item.role.code === role),
                  )
                  const hasOwnerRole = member.roles.some((item) => item.role.code === 'OWNER')
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="member-identity">
                          <span className="member-avatar">
                            {(member.user.name || member.user.email).slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{member.user.name || '未设置姓名'}</strong>
                            <small>{member.user.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="member-roles">
                          {member.roles.map(({ role }) => (
                            <span
                              key={role.code}
                              className={`member-role role-${role.code.toLowerCase()}`}
                            >
                              {roleLabels[role.code] || role.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="created-at">{formatDate(member.joinedAt)}</td>
                      {canManage && (
                        <td>
                          <div className="member-management">
                            {availableRoles.length > 0 && (
                              <>
                                <select
                                  aria-label={`为${member.user.email}追加角色`}
                                  value={roleByMember[member.id] || availableRoles[0]}
                                  onChange={(event) =>
                                    setRoleByMember((current) => ({
                                      ...current,
                                      [member.id]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="" disabled>
                                    选择角色
                                  </option>
                                  {availableRoles.map((role) => (
                                    <option key={role} value={role}>
                                      {roleLabels[role]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="member-add-role"
                                  disabled={busy}
                                  onClick={() => void addRole(member)}
                                >
                                  追加角色
                                </button>
                              </>
                            )}
                            {!hasOwnerRole && (
                              <button
                                className="member-remove"
                                disabled={busy}
                                onClick={() => void removeMember(member)}
                              >
                                移除
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3}>
                    <div className="links-empty">
                      <span className="empty-link-icon">♧</span>
                      <strong>还没有其他成员</strong>
                      <p>添加已注册的用户，与团队共享此工作空间。</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="members-role-note">
        角色为叠加授权：追加角色不会移除已有角色。当前后端接口支持追加角色，暂不支持撤销单个角色。
      </p>
    </section>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}
