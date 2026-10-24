import { Apple, Dumbbell, Home, TrendingUp, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'

const ITEMS = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/workouts', label: 'Muscu', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Apple },
  { to: '/progress', label: 'Progrès', icon: TrendingUp },
  { to: '/profile', label: 'Profil', icon: User },
]

export function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition', isActive ? 'text-lime-400' : 'text-zinc-400')
            }
          >
            <Icon size={22} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
