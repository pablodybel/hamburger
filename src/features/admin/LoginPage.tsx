import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/services/api'
import { qk } from '@/hooks/queries'
import { IS_DEMO } from '@/lib/supabase'
import { Wordmark } from '@/components/Brand'
import { FoodGlyph } from '@/components/FoodGlyph'

export default function LoginPage() {
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/admin'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState(IS_DEMO ? (next.startsWith('/kitchen') ? 'cocina@laplancha.com' : 'admin@laplancha.com') : '')
  const [password, setPassword] = useState(IS_DEMO ? 'plancha' : '')

  const login = useMutation({
    mutationFn: () => api.signIn(email.trim(), password),
    onSuccess: (s) => {
      qc.setQueryData(qk.session, s)
      navigate(s.role === 'kitchen' ? '/kitchen' : next, { replace: true })
    },
  })

  return (
    <div className="paper-grain grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col">
        <div className="halftone absolute inset-0 text-mustard/30" />
        <div className="checker absolute inset-x-0 top-0" />
        <p className="label-mono relative mt-6 text-paper/50">staff · caja · cocina</p>
        <Wordmark light className="relative mt-auto text-[7.5rem]" />
        <p className="relative mt-6 max-w-sm text-lg text-paper/60">Pedidos, cobros y menú de la casa. Todo en vivo.</p>
        <FoodGlyph kind="hamburguesas" className="absolute -right-10 bottom-40 size-72 rotate-12" />
      </aside>

      <main className="grid place-items-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            login.mutate()
          }}
          className="w-full max-w-sm"
        >
          <Wordmark className="text-5xl lg:hidden" />
          <h1 className="mt-6 font-display text-4xl lg:mt-0">Ingresá</h1>
          <p className="mt-1 text-ink-soft">Solo para el equipo de La Plancha.</p>

          <label className="mt-8 block">
            <span className="label-mono text-ink-soft">email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-2 border-ink bg-thermal px-4 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-mustard/60"
            />
          </label>
          <label className="mt-4 block">
            <span className="label-mono text-ink-soft">contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-2 border-ink bg-thermal px-4 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-mustard/60"
            />
          </label>

          {login.error && <p className="mt-4 text-sm font-semibold text-ketchup">{(login.error as Error).message}</p>}

          <button disabled={login.isPending} className="btn-hard mt-6 h-13 w-full bg-ketchup py-3.5 text-lg text-paper">
            {login.isPending ? <Loader2 className="size-5 animate-spin" /> : <>Entrar <ArrowRight className="size-5" /></>}
          </button>

          {IS_DEMO && (
            <p className="mt-6 rounded-xl border-2 border-dashed border-ink/25 p-3 text-[13px] leading-snug text-ink-soft">
              <b>Modo demo:</b> cualquier contraseña de 4+ caracteres. Un email que empiece con <code className="font-mono">cocina@</code> entra
              con rol cocina; cualquier otro, como admin.
            </p>
          )}
        </form>
      </main>
    </div>
  )
}
