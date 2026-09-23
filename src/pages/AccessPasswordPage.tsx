import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { accessRequest, readAccessSession, type AccessResult } from './accessApi'

type UnlockResult = { unlock: true; token: string; expiresIn: number }

export default function AccessPasswordPage() {
  const { code = '' } = useParams()
  const [checking, setChecking] = useState(Boolean(readAccessSession()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const authorizedAccess = useRef<Promise<AccessResult> | null>(null)

  useEffect(() => {
    if (!code) {
      setChecking(false)
      setError('短链地址不完整。')
      return
    }
    const session = readAccessSession()
    if (!session) {
      setChecking(false)
      return
    }
    let active = true
    if (!authorizedAccess.current)
      authorizedAccess.current = accessRequest<AccessResult>(
        `/r/${encodeURIComponent(code)}/access`,
        { method: 'POST' },
        session,
      )
    authorizedAccess.current
      .then(({ url }) => {
        if (active) window.location.replace(url)
      })
      .catch(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [code])

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const password = String(new FormData(event.currentTarget).get('password'))
    try {
      const { token } = await accessRequest<UnlockResult>(
        `/r/${encodeURIComponent(code)}/unlock`,
        {
          method: 'POST',
          body: JSON.stringify({ password }),
        },
        null,
      )
      const result = await accessRequest<AccessResult>(
        `/r/${encodeURIComponent(code)}/access`,
        {
          method: 'POST',
          headers: { 'x-share-access-token': token },
        },
        null,
      )
      window.location.replace(result.url)
    } catch (cause) {
      setError(
        cause instanceof Error && /Invalid share password/.test(cause.message)
          ? '密码不正确，请重试。'
          : cause instanceof Error
            ? cause.message
            : '解锁失败，请重试。',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="access-shell">
      <div className="access-card">
        <div className="access-brand">
          <span className="brand-icon">↗</span>
          <span>短链工场</span>
        </div>
        {checking ? (
          <div className="access-checking">
            <span className="loading-spinner" />
            正在验证访问权限…
          </div>
        ) : (
          <>
            <span className="overline">PASSWORD PROTECTED</span>
            <h1>输入访问密码</h1>
            <p className="access-description">
              此短链受密码保护。输入创建者设置的密码，验证成功后将自动跳转。
            </p>
            <form onSubmit={(event) => void unlock(event)}>
              <label>
                访问密码
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  maxLength={128}
                  required
                  autoFocus
                  placeholder="输入短链访问密码"
                />
              </label>
              {error && <div className="message error-message">{error}</div>}
              <button className="primary-button access-submit" disabled={busy}>
                {busy ? '正在验证…' : '验证并继续'}
                <span>→</span>
              </button>
            </form>
            <div className="access-security">
              <i /> 密码只用于本次短链访问验证
            </div>
          </>
        )}
      </div>
    </main>
  )
}
