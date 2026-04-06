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
import {
  BarChart3,
  BookOpen,
  Building2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  Menu,
  School,
  UserRound,
} from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
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
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-3 text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
                required
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1 block text-sm text-slate-400"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-10 text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
          <span className="flex items-center justify-center gap-2">
            <Fingerprint className="h-4 w-4" />
            {faceBusy ? 'Waiting for authenticator…' : 'Login with Face ID'}
          </span>
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
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  async function disableFaceId() {
    setErr('')
    setBusy(true)
    try {
      await api.webauthnDisable()
      await refresh()
    } catch (e) {
      setErr(e.message || 'Could not disable passkey')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900/95 px-4 py-6 transition-transform md:static md:translate-x-0 md:bg-slate-900/90 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold">
            U
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              UrSPI Admin
            </p>
            <p className="text-sm font-semibold text-slate-100">Admin Panel</p>
          </div>
        </div>

        <nav className="space-y-1 text-base md:text-sm">
          <button
            type="button"
            onClick={() => {
              setActiveMenu('dashboard')
              setSidebarOpen(false)
            }}
            className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition md:px-3 md:py-2 ${
              activeMenu === 'dashboard'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 md:h-4 md:w-4" />
              Dashboard
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMenu('fakultetlar')
              setSidebarOpen(false)
            }}
            className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition md:px-3 md:py-2 ${
              activeMenu === 'fakultetlar'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <School className="h-5 w-5 md:h-4 md:w-4" />
              Fakultetlar
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMenu('kafedralar')
              setSidebarOpen(false)
            }}
            className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition md:px-3 md:py-2 ${
              activeMenu === 'kafedralar'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-5 w-5 md:h-4 md:w-4" />
              Kafedralar
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMenu('oqituvchilar')
              setSidebarOpen(false)
            }}
            className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition md:px-3 md:py-2 ${
              activeMenu === 'oqituvchilar'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <UserRound className="h-5 w-5 md:h-4 md:w-4" />
              O'qituvchilar
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMenu('fingerprint')
              setSidebarOpen(false)
            }}
            className={`mt-4 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition md:px-3 md:py-2 ${
              activeMenu === 'fingerprint'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 md:h-4 md:w-4" />
              Barmoq izini tasdiqlash
            </span>
          </button>
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-4 text-xs text-slate-500">
          <p>{user?.email}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 text-left text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            Chiqish
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8">
        <header className="mb-4 flex items-start justify-between gap-4 sm:mb-6 sm:items-center">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Admin Dashboard
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold text-slate-50 sm:mt-0">
              Salom{user?.email ? `, ${user.email}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-lg text-slate-100 hover:bg-slate-800 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden items-center gap-3 rounded-full bg-slate-900 px-3 py-1 text-sm sm:flex">
              <span className="h-8 w-8 rounded-full bg-emerald-600 text-center text-xs font-semibold leading-8">
                AD
              </span>
              <span className="text-slate-100">admin</span>
            </div>
          </div>
        </header>

        {activeMenu === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-xs text-slate-400">Fakultetlar</p>
                <p className="mt-3 text-2xl font-semibold text-emerald-400">5</p>
              </div>
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-xs text-slate-400">Kafedralar</p>
                <p className="mt-3 text-2xl font-semibold text-emerald-400">15</p>
              </div>
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-xs text-slate-400">O'qituvchilar</p>
                <p className="mt-3 text-2xl font-semibold text-emerald-400">302</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-900/80 p-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Line graph (oddiy)
                  </h2>
                  <span className="text-xs text-slate-500">So‘nggi 7 kun</span>
                </div>
                <div className="mt-4">
                  <svg
                    viewBox="0 0 320 160"
                    className="h-44 w-full overflow-visible"
                    role="img"
                    aria-label="Simple line graph"
                  >
                    <path
                      d="M20 20V140H310"
                      fill="none"
                      stroke="rgba(148,163,184,0.35)"
                      strokeWidth="2"
                    />
                    <path
                      d="M20 120 L65 105 L110 115 L155 80 L200 90 L245 55 L290 65"
                      fill="none"
                      stroke="rgba(16,185,129,1)"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 120 L65 105 L110 115 L155 80 L200 90 L245 55 L290 65 L290 140 L20 140 Z"
                      fill="rgba(16,185,129,0.12)"
                    />
                    {[
                      [20, 120],
                      [65, 105],
                      [110, 115],
                      [155, 80],
                      [200, 90],
                      [245, 55],
                      [290, 65],
                    ].map(([x, y], i) => (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="rgba(16,185,129,1)"
                        stroke="rgba(15,23,42,1)"
                        strokeWidth="2"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/80 p-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Bar chart (oddiy)
                  </h2>
                  <span className="text-xs text-slate-500">Kategoriyalar</span>
                </div>
                <div className="mt-6 flex items-end justify-between gap-3">
                  {[72, 90, 60, 110, 85, 125].map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-lg bg-emerald-500/90"
                        style={{ height: `${h}px` }}
                      />
                      <span className="text-[10px] text-slate-400">K{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'fingerprint' && (
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold text-slate-100">
              Barmoq izi / Face ID ni tasdiqlash
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Hisobingiz uchun passkey (barmoq izi, Face ID yoki Windows Hello)
              sozlang. Keyingi safar tizimga kirganda{' '}
              <span className="font-semibold text-slate-200">
                Login with Face ID
              </span>{' '}
              tugmasidan foydalanishingiz mumkin bo'ladi.
            </p>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  Passkey (barmoq izi / Face ID)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Holat:{' '}
                  <span
                    className={
                      user?.webauthnEnabled ? 'text-emerald-400' : 'text-amber-400'
                    }
                  >
                    {user?.webauthnEnabled ? 'yoqilgan' : 'o‘chiq'}
                  </span>
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={!!user?.webauthnEnabled}
                  disabled={busy}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      await enableFaceId()
                    } else {
                      await disableFaceId()
                    }
                  }}
                />
                <div className="h-7 w-12 rounded-full bg-slate-700 transition peer-checked:bg-emerald-600 peer-disabled:opacity-50">
                  <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                </div>
              </label>
            </div>

            {!canWebAuthn ? (
              <p className="mt-3 text-xs text-amber-400">
                WebAuthn bu brauzerda ishlamaydi. Iltimos, Chrome yoki mos
                keluvchi brauzerdan foydalaning.
              </p>
            ) : null}

            {err ? (
              <p className="mt-4 text-sm text-rose-400" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        )}
      </main>
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
