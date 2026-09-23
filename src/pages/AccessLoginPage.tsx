import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  accessRequest,
  readAccessSession,
  saveAccessSession,
  type AccessResult,
  type AccessSession,
} from './accessApi'

export default function AccessLoginPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const [checking, setChecking] = useState(Boolean(readAccessSession()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const initialAccess = useRef<Promise<AccessResult> | null>(null)

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
    if (!initialAccess.current)
      initialAccess.current = accessRequest<AccessResult>(
        `/r/${encodeURIComponent(code)}/access`,
        { method: 'POST' },
        session,
      )
    initialAccess.current
      .then(({ url }) => {
        if (active) window.location.replace(url)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setChecking(false)
        const message = cause instanceof Error ? cause.message : '无法验证当前账号。'
        if (/登录状态已过期/.test(message)) setError('登录状态已过期，请重新登录后继续访问。')
        else setError('当前账号没有访问此短链的权限，请使用有权限的账号登录。')
      })
    return () => {
      active = false
    }
  }, [code])

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!code) {
      setError('短链地址不完整。')
      return
    }
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    let session: AccessSession
    try {
      session = await accessRequest<AccessSession>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: String(form.get('email')).trim(),
            password: String(form.get('password')),
          }),
        },
        null,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请检查邮箱和密码。')
      setBusy(false)
      return
    }
    saveAccessSession(session)
    try {
      const result = await accessRequest<AccessResult>(
        `/r/${encodeURIComponent(code)}/access`,
        { method: 'POST' },
        session,
      )
      window.location.replace(result.url)
    } catch (cause) {
      setError(
        cause instanceof Error && /登录状态已过期/.test(cause.message)
          ? cause.message
          : '登录成功，但当前账号没有访问此短链的权限。',
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
            正在验证你的登录状态…
          </div>
        ) : (
          <>
            <span className="overline">MEMBER ACCESS</span>
            <h1>登录后继续访问</h1>
            <p className="access-description">
              此短链仅限空间成员或创建者访问。登录后系统会自动校验权限并继续跳转。
            </p>
            <form onSubmit={(event) => void signIn(event)}>
              <label>
                邮箱
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@company.com"
                />
              </label>
              <label>
                密码
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="输入账号密码"
                />
              </label>
              {error && <div className="message error-message">{error}</div>}
              <button className="primary-button access-submit" disabled={busy}>
                {busy ? '正在登录并验证…' : '登录并继续'}
                <span>→</span>
              </button>
            </form>
            <div className="access-security">
              <i /> 密码通过加密连接提交，仅用于账号验证
            </div>
          </>
        )}
      </div>
    </main>
  )
}
