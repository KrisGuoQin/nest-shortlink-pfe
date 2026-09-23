import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiRequest, AuditLog, Workspace } from './types'

type Props = { workspace: Workspace | null; request: ApiRequest }
type AuditResponse = {
  data: AuditLog[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
const actionLabels: Record<string, string> = {
  'shortlink.create': '创建短链',
  'shortlink.update': '修改短链',
  'shortlink.delete': '删除短链',
  'shortlink.access.update': '修改访问设置',
}
const resourceLabels: Record<string, string> = {
  ShortLink: '短链',
  Workspace: '工作空间',
  WorkspaceMember: '空间成员',
}

export default function AuditPage({ workspace, request }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const loadLogs = useCallback(async () => {
    const sequence = ++requestSequence.current
    if (!workspace) {
      setLogs([])
      setTotal(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await request<AuditResponse>(
        `/workspaces/${workspace.id}/audit-logs?page=${page}&pageSize=${pageSize}`,
      )
      if (sequence !== requestSequence.current) return
      setLogs(result.data)
      setTotal(result.pagination.total)
      setTotalPages(Math.max(1, result.pagination.totalPages))
    } catch (cause) {
      if (sequence !== requestSequence.current) return
      setLogs([])
      setTotal(0)
      setTotalPages(1)
      setError(cause instanceof Error ? cause.message : '审计日志加载失败')
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [page, pageSize, request, workspace])

  useEffect(() => {
    setPage(1)
  }, [workspace?.id])
  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  function changePageSize(value: number) {
    setPageSize(value)
    setPage(1)
  }

  if (!workspace)
    return (
      <section className="main-content">
        <div className="page-title">
          <div>
            <span className="overline">AUDIT LOG</span>
            <h1>审计日志</h1>
            <p>先选择一个工作空间查看操作记录。</p>
          </div>
        </div>
        <div className="empty-workspaces">
          <div className="empty-symbol">◷</div>
          <h3>选择一个工作空间</h3>
          <p>审计日志按工作空间分别记录。</p>
        </div>
      </section>
    )

  return (
    <section className="main-content audit-content">
      <div className="page-title">
        <div>
          <span className="overline">AUDIT LOG</span>
          <h1>审计日志</h1>
          <p>查看「{workspace.name}」中的管理操作与变更记录。</p>
        </div>
        <button className="refresh-button" disabled={loading} onClick={() => void loadLogs()}>
          ⟳ 刷新
        </button>
      </div>
      {error && (
        <div className="message error-message page-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      <div className="audit-summary">
        <div className="audit-summary-icon">◷</div>
        <div>
          <strong>{total}</strong>
          <span>条审计记录</span>
        </div>
        <small>记录按发生时间倒序排列</small>
      </div>
      <section className="audit-panel">
        <div className="links-panel-heading">
          <div>
            <h2>操作记录</h2>
            <p>保留操作对象、操作者及变更摘要</p>
          </div>
          <label className="audit-page-size">
            每页
            <select
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            条
          </label>
        </div>
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>操作</th>
                <th>操作者</th>
                <th>资源</th>
                <th>发生时间</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="links-empty">
                      <span className="loading-spinner" />
                      正在加载审计日志…
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={`audit-action audit-${actionTone(log.action)}`}>
                        <i />
                        {actionLabels[log.action] || log.action}
                      </span>
                      <small className="audit-action-code">{log.action}</small>
                    </td>
                    <td>
                      <span className="audit-actor">
                        {log.actorUserId ? `用户 ${shortId(log.actorUserId)}` : '系统'}
                      </span>
                      {log.actorUserId && (
                        <small className="audit-id" title={log.actorUserId}>
                          {log.actorUserId}
                        </small>
                      )}
                    </td>
                    <td>
                      <strong className="audit-resource">
                        {resourceLabels[log.resourceType] || log.resourceType}
                      </strong>
                      <small className="audit-id" title={log.resourceId || ''}>
                        {log.resourceId ? shortId(log.resourceId) : '—'}
                      </small>
                    </td>
                    <td className="audit-time">{formatDateTime(log.createdAt)}</td>
                    <td>
                      <details className="audit-details">
                        <summary>查看详情</summary>
                        <div className="audit-details-popover">
                          <dl>
                            <dt>事件 ID</dt>
                            <dd>{log.eventId}</dd>
                            <dt>请求 ID</dt>
                            <dd>{log.requestId || '—'}</dd>
                            <dt>资源 ID</dt>
                            <dd>{log.resourceId || '—'}</dd>
                            <dt>元数据</dt>
                            <dd>
                              <pre>{formatMetadata(log.metadata)}</pre>
                            </dd>
                          </dl>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
              {!loading && !logs.length && (
                <tr>
                  <td colSpan={5}>
                    <div className="links-empty">
                      <span className="empty-link-icon">◷</span>
                      <strong>{error ? '暂时无法读取日志' : '暂无审计记录'}</strong>
                      <p>
                        {error
                          ? '请确认你有查看审计日志的权限，或稍后重试。'
                          : '有审计记录的操作发生后，会显示在这里。'}
                      </p>
                      {!error && (
                        <button className="refresh-button" onClick={() => void loadLogs()}>
                          ⟳ 刷新
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
      </section>
      <p className="audit-retention-note">
        操作者信息当前以账号 ID 展示；审计日志数据由后端写入，不支持前端编辑或删除。
      </p>
    </section>
  )
}

function actionTone(action: string) {
  return action.includes('delete') ? 'danger' : action.includes('create') ? 'success' : 'update'
}
function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-5)}` : id
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}
function formatMetadata(metadata: unknown) {
  if (metadata === null || metadata === undefined) return '无附加数据'
  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return String(metadata)
  }
}
