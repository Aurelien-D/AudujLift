import { Apple, Dumbbell, Home, TrendingUp, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'

const ITEMS = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/workouts', label: 'Séances', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Apple },
  { to: '/progress', label: 'Progrès', icon: TrendingUp },
  { to: '/profile', label: 'Profil', icon: User },
]

export function BottomNav() {
  return (
    <nav aria-label="Navigation principale" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-ink/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'press relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 pt-1.5 pb-1 text-[10.5px] font-medium tracking-wide',
                isActive ? 'text-gold' : 'text-silver',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('absolute top-0 h-0.5 rounded-full bg-gold transition-all duration-200', isActive ? 'w-6 opacity-100' : 'w-0 opacity-0')} />
                <Icon size={22} strokeWidth={isActive ? 2 : 1.6} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
