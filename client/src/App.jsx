import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import * as api from './auth.js'

const AuthContext = createContext(null)

function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.me()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      async signOut() {
        await api.logout()
        setUser(null)
      },
    }),
    [user, loading, refresh]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

function Card({ title, children }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-black/40 backdrop-blur">
      <h1 className="mb-6 text-center text-xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      {children}
    </div>
  )
}

function Hint() {
  return (
    <div className="mt-6 space-y-2 rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 text-xs leading-relaxed text-slate-400">
      <p>
        <span className="font-medium text-slate-300">Chrome</span> is recommended
        for WebAuthn. Production must use{' '}
        <span className="text-slate-300">HTTPS</span>;{' '}
        <span className="text-slate-300">localhost</span> works without HTTPS for
        development.
      </p>
      <p>
        Face ID / fingerprint needs a{' '}
        <span className="text-slate-300">real device</span> (or platform
        authenticator such as Windows Hello). Simulators often cannot create
        passkeys the same way.
      </p>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [faceBusy, setFaceBusy] = useState(false)

  const canWebAuthn =
    typeof window !== 'undefined' && window.PublicKeyCredential != null

  async function onPasswordSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const data = await api.login(email, password)
      setUser(data.user)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function onFaceIdLogin() {
    if (!email.trim()) {
      setErr('Enter your email first.')
      return
    }
    if (!canWebAuthn) {
      setErr('WebAuthn is not available in this browser.')
      return
    }
    setErr('')
    setFaceBusy(true)
    try {
      const options = await api.webauthnLoginOptions(email.trim())
      const assertion = await startAuthentication({ optionsJSON: options })
      const data = await api.webauthnLoginVerify(assertion)
      setUser(data.user)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message || 'Face ID sign-in failed')
    } finally {
      setFaceBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card title="Sign in">
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
              required
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm text-slate-400"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
              required
            />
          </div>
          {err ? (
            <p className="text-sm text-rose-400" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900/80 px-2 text-slate-500">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onFaceIdLogin}
          disabled={faceBusy || !canWebAuthn}
          className="w-full rounded-lg border border-slate-600 bg-slate-800/50 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {faceBusy ? 'Waiting for authenticator…' : 'Login with Face ID'}
        </button>
        {!canWebAuthn ? (
          <p className="mt-2 text-center text-xs text-amber-400/90">
            WebAuthn is unavailable (use a supported browser or HTTPS in
            production).
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{' '}
          <Link to="/register" className="text-emerald-400 hover:underline">
            Register
          </Link>
        </p>
        <Hint />
      </Card>
    </div>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const data = await api.register(email, password)
      setUser(data.user)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message || 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card title="Create account">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
              required
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm text-slate-400"
              htmlFor="reg-password"
            >
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
              required
              minLength={8}
            />
          </div>
          {err ? (
            <p className="text-sm text-rose-400" role="alert">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
        <Hint />
      </Card>
    </div>
  )
}

function DashboardPage() {
  const { user, refresh, signOut } = useAuth()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const canWebAuthn =
    typeof window !== 'undefined' && window.PublicKeyCredential != null

  async function enableFaceId() {
    if (!canWebAuthn) {
      setErr('WebAuthn is not available in this browser.')
      return
    }
    setErr('')
    setBusy(true)
    try {
      const options = await api.webauthnRegisterOptions()
      const attResp = await startRegistration({ optionsJSON: options })
      await api.webauthnRegisterVerify(attResp)
      await refresh()
    } catch (e) {
      setErr(e.message || 'Could not register passkey')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-wider text-slate-500">
          Dashboard
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          Hello{user?.email ? `, ${user.email}` : ''}
        </h2>
        <p className="mt-2 text-slate-400">
          Passkey (Face ID / fingerprint):{' '}
          <span
            className={
              user?.webauthnEnabled ? 'text-emerald-400' : 'text-amber-400'
            }
          >
            {user?.webauthnEnabled ? 'enabled' : 'not set up yet'}
          </span>
        </p>

        {!user?.webauthnEnabled ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={enableFaceId}
              disabled={busy || !canWebAuthn}
              className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Follow the prompt on your device…' : 'Enable Face ID'}
            </button>
            {!canWebAuthn ? (
              <p className="mt-2 text-xs text-amber-400">
                WebAuthn is not available here. Use Chrome on a real device.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-sm text-slate-500">
            You can use <strong className="text-slate-300">Login with Face ID</strong>{' '}
            on the sign-in page with the same email.
          </p>
        )}

        {err ? (
          <p className="mt-4 text-sm text-rose-400" role="alert">
            {err}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-10 text-sm text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
