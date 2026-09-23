import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnalyticsResponse, ApiRequest, ShortLink, Workspace } from './types'

type Props = { workspace: Workspace | null; request: ApiRequest }
type LinkOption = Pick<ShortLink, 'id' | 'code' | 'title'>

export default function AnalyticsPage({ workspace, request }: Props) {
  const [rangeDays, setRangeDays] = useState(30)
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')
  const [fromDate, setFromDate] = useState(() => dateOffset(-29))
  const [toDate, setToDate] = useState(() => dateOffset(0))
  const [linkOptions, setLinkOptions] = useState<LinkOption[]>([])
  const [selectedLinkId, setSelectedLinkId] = useState('')
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  useEffect(() => {
    if (!workspace) {
      setLinkOptions([])
      setAnalytics(null)
      return
    }
    let cancelled = false
    request<{ data: LinkOption[] }>(`/workspaces/${workspace.id}/links?page=1&pageSize=100`)
      .then((result) => {
        if (!cancelled) setLinkOptions(result.data)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '无法加载短链筛选项')
      })
    return () => {
      cancelled = true
    }
  }, [request, workspace])

  const from = useMemo(() => localDateStart(fromDate), [fromDate])
  const to = useMemo(() => localDateStart(toDate, 1), [toDate])

  const loadAnalytics = useCallback(async () => {
    if (!workspace) return
    if (!fromDate || !toDate || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setError('请选择有效的开始和结束日期。')
      return
    }
    if (from >= to) {
      setError('开始日期必须早于结束日期。')
      return
    }
    const elapsedDays = (to.getTime() - from.getTime()) / 86400000
    const maxDays = granularity === 'hour' ? 7 : 90
    if (elapsedDays > maxDays) {
      setError(`此粒度最多可查询 ${maxDays} 天。`)
      return
    }
    setLoading(true)
    setError('')
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      timezone,
    })
    const endpoint = selectedLinkId
      ? `/workspaces/${workspace.id}/links/${selectedLinkId}/analytics?${query}`
      : `/workspaces/${workspace.id}/analytics?${query}`
    try {
      setAnalytics(await request<AnalyticsResponse>(endpoint))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '分析数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [from, granularity, request, selectedLinkId, to, timezone, workspace])

  useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  function choosePreset(days: number) {
    setRangeDays(days)
    if (days > 7 && granularity === 'hour') setGranularity('day')
    setFromDate(dateOffset(1 - days))
    setToDate(dateOffset(0))
  }

  const maxClicks = Math.max(1, ...(analytics?.timeSeries.map((point) => point.clicks) || []))
  const activeLinks = linkOptions.length
  const heading = selectedLinkId ? '单条短链分析' : '工作空间分析'

  return (
    <section className="main-content analytics-content">
      <div className="page-title">
        <div>
          <span className="overline">LINK ANALYTICS</span>
          <h1>{heading}</h1>
          <p>
            {selectedLinkId
              ? '查看所选短链的访问表现、来源和设备分布。'
              : '掌握工作空间内的访问趋势、来源和热门短链。'}
          </p>
        </div>
        <button
          className="analytics-refresh"
          onClick={() => void loadAnalytics()}
          disabled={loading}
        >
          {loading ? '加载中…' : '⟳ 刷新数据'}
        </button>
      </div>
      {error && (
        <div className="message error-message analytics-error">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      {!workspace ? (
        <div className="empty-workspaces">
          <div className="empty-symbol">⌂</div>
          <h3>选择一个工作空间</h3>
          <p>分析数据按工作空间汇总。</p>
        </div>
      ) : (
        <>
          <div className="analytics-filters">
            <label className="analytics-link-select">
              <span>分析对象</span>
              <select
                value={selectedLinkId}
                onChange={(event) => setSelectedLinkId(event.target.value)}
              >
                <option value="">整个工作空间</option>
                {linkOptions.map((link) => (
                  <option key={link.id} value={link.id}>
                    {link.title || link.code} · /{link.code}
                  </option>
                ))}
              </select>
            </label>
            <div className="date-presets">
              <button className={rangeDays === 7 ? 'selected' : ''} onClick={() => choosePreset(7)}>
                7 天
              </button>
              <button
                className={rangeDays === 30 ? 'selected' : ''}
                onClick={() => choosePreset(30)}
              >
                30 天
              </button>
              <button
                className={rangeDays === 90 ? 'selected' : ''}
                onClick={() => choosePreset(90)}
              >
                90 天
              </button>
            </div>
            <div className="date-range-fields">
              <label>
                <span>从</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    setRangeDays(0)
                  }}
                />
              </label>
              <span className="date-separator">—</span>
              <label>
                <span>至</span>
                <input
                  type="date"
                  value={toDate}
                  max={dateOffset(0)}
                  min={fromDate}
                  onChange={(event) => {
                    setToDate(event.target.value)
                    setRangeDays(0)
                  }}
                />
              </label>
            </div>
            <div className="analytics-granularity">
              <button
                className={granularity === 'day' ? 'selected' : ''}
                onClick={() => setGranularity('day')}
              >
                按日
              </button>
              <button
                className={granularity === 'hour' ? 'selected' : ''}
                onClick={() => {
                  setGranularity('hour')
                  const days =
                    (localDateStart(toDate, 1).getTime() - localDateStart(fromDate).getTime()) /
                    86400000
                  if (days > 7) choosePreset(7)
                }}
              >
                按小时
              </button>
            </div>
          </div>
          <div className="analytics-kpis">
            <Metric
              label="访问量"
              value={analytics?.summary.clicks}
              icon="↗"
              tone="purple"
              caption={selectedLinkId ? '所选短链的访问次数' : `${activeLinks} 条短链参与统计`}
            />
            <Metric
              label="独立访客"
              value={analytics?.summary.uniqueIps}
              icon="♙"
              tone="blue"
              caption="按匿名 IP 地址去重"
            />
            <div className="privacy-note">
              <span>i</span>
              <p>独立访客按匿名 IP 统计，并不等同于实际人数。</p>
            </div>
          </div>
          <section className="analytics-panel trend-panel">
            <div className="analytics-panel-head">
              <div>
                <h2>访问趋势</h2>
                <p>
                  {fromDate} — {toDate} · {timezone}
                </p>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-visits" />
                  访问量
                </span>
                <span>
                  <i className="legend-unique" />
                  独立访客
                </span>
              </div>
            </div>
            {loading ? (
              <div className="analytics-loading">
                <span className="loading-spinner" />
                正在读取访问数据…
              </div>
            ) : analytics?.timeSeries.length ? (
              <div className="analytics-chart">
                {analytics.timeSeries.slice(-28).map((point) => (
                  <div
                    className="analytics-bar-group"
                    key={point.bucket}
                    title={`${point.bucket} · 访问 ${point.clicks} · 独立访客 ${point.uniqueIps}`}
                  >
                    <div className="analytics-bars">
                      <i
                        className="visit-bar"
                        style={{ height: `${Math.max(2, (point.clicks / maxClicks) * 100)}%` }}
                      />
                      <i
                        className="unique-bar"
                        style={{ height: `${Math.max(2, (point.uniqueIps / maxClicks) * 100)}%` }}
                      />
                    </div>
                    <span>{bucketLabel(point.bucket, granularity)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="analytics-empty">所选时间范围暂无访问记录。</div>
            )}
          </section>
          <div className="analytics-detail-grid">
            <DimensionPanel
              title="访问来源"
              description="来源域名或直接访问"
              items={analytics?.referrers || []}
              empty={loading ? '正在加载…' : '暂无来源数据'}
            />
            <DimensionPanel
              title="设备类型"
              description="根据访问端浏览器信息识别"
              items={analytics?.devices || []}
              empty={loading ? '正在加载…' : '暂无设备数据'}
            />
            <DimensionPanel
              title="浏览器"
              description="访问者使用的浏览器"
              items={analytics?.browsers || []}
              empty={loading ? '正在加载…' : '暂无浏览器数据'}
            />
          </div>
          {!selectedLinkId && (
            <section className="analytics-panel top-links-panel">
              <div className="analytics-panel-head">
                <div>
                  <h2>热门短链</h2>
                  <p>所选时间范围内访问量最高的链接</p>
                </div>
                <span className="top-links-count">TOP 10</span>
              </div>
              {analytics?.topLinks?.length ? (
                <div className="top-links-list">
                  {analytics.topLinks.map((link, index) => (
                    <div className="top-link-row" key={link.shortLinkId}>
                      <span className="top-link-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="top-link-icon">↗</span>
                      <div className="top-link-meta">
                        <strong>{link.title || link.shortCode}</strong>
                        <small>/{link.shortCode}</small>
                      </div>
                      <strong className="top-link-clicks">
                        {link.clicks.toLocaleString()}
                        <small> 次访问</small>
                      </strong>
                      <button
                        className="analyze-link-button"
                        onClick={() => setSelectedLinkId(link.shortLinkId)}
                      >
                        查看分析 →
                      </button>
                    </div>
                  ))}
                  {loading && <div className="analytics-refresh-mask">正在更新…</div>}
                </div>
              ) : (
                <div className="analytics-empty compact">
                  {loading ? '正在加载热门链接…' : '暂无热门短链数据。'}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </section>
  )
}

function Metric({
  label,
  value,
  icon,
  tone,
  caption,
}: {
  label: string
  value?: number
  icon: string
  tone: string
  caption: string
}) {
  return (
    <article className="analytics-metric">
      <div className={`analytics-metric-icon ${tone}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value === undefined ? '—' : value.toLocaleString()}</strong>
      <small>{caption}</small>
    </article>
  )
}

function DimensionPanel({
  title,
  description,
  items,
  empty,
}: {
  title: string
  description: string
  items: { value: string; clicks: number }[]
  empty: string
}) {
  const max = Math.max(1, ...items.map((item) => item.clicks))
  return (
    <section className="analytics-panel dimension-panel">
      <div className="analytics-panel-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {items.length ? (
        <div className="dimension-list">
          {items.slice(0, 6).map((item) => (
            <div className="dimension-row" key={item.value}>
              <div className="dimension-label">
                <span>{dimensionLabel(item.value)}</span>
                <strong>{item.clicks.toLocaleString()}</strong>
              </div>
              <div className="dimension-track">
                <i style={{ width: `${Math.max(2, (item.clicks / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dimension-empty">{empty}</div>
      )}
    </section>
  )
}

function dimensionLabel(value: string) {
  return (
    (
      {
        direct: '直接访问',
        desktop: '桌面设备',
        mobile: '手机',
        tablet: '平板',
        bot: '机器人',
        unknown: '未知',
        other: '其他',
      } as Record<string, string>
    )[value] || value
  )
}
function dateOffset(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return localDateString(date)
}
function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function localDateStart(value: string, offset = 0) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return date
}
function bucketLabel(value: string, granularity: 'day' | 'hour') {
  return granularity === 'hour' ? value.slice(11, 16) : value.slice(5, 10)
}
