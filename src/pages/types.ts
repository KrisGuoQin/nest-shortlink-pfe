export type Workspace = {
  id: string
  name: string
  slug: string
  createdAt: string
  roles: string[]
}
export type User = { id: string; name?: string | null; email: string }
export type ShortLink = {
  id: string
  code: string
  title?: string | null
  originalUrl: string
  shortUrl: string
  status: 'ACTIVE' | 'DISABLED'
  visibility: 'PUBLIC' | 'WORKSPACE' | 'PRIVATE' | 'PASSWORD'
  createdAt: string
  expiresAt?: string | null
  maxVisits?: number | null
}
export type SharedUser = { id: string; email: string; name?: string | null }
export type WorkspaceMember = {
  id: string
  joinedAt: string
  user: User
  roles: { role: { code: string; name: string } }[]
}
export type AuditLog = {
  id: string
  eventId: string
  workspaceId: string | null
  actorUserId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  requestId: string | null
  metadata: unknown
  createdAt: string
}
export type ApiRequest = <T>(path: string, options?: RequestInit) => Promise<T>
export type AnalyticsResponse = {
  link?: { id: string; code: string; title?: string | null }
  range: { from: string; to: string; timezone: string; granularity: 'hour' | 'day' }
  summary: { clicks: number; uniqueIps: number; uniqueIpsDefinition?: string }
  timeSeries: { bucket: string; clicks: number; uniqueIps: number }[]
  referrers: { value: string; clicks: number }[]
  devices: { value: string; clicks: number }[]
  browsers: { value: string; clicks: number }[]
  topLinks?: { shortLinkId: string; shortCode: string; title?: string | null; clicks: number }[]
}
