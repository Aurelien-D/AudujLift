import { Component, type ReactNode } from 'react'

const RELOAD_KEY = 'audujlift.chunkReloadAt'

/** Fichier JS introuvable : l'appli ouverte date d'avant une mise à jour (ses fichiers ont changé de nom). */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(msg)
}

/** Recharge une seule fois par minute, pour éviter une boucle si le serveur est vraiment indisponible. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    /* stockage indisponible : on recharge quand même */
  }
  location.reload()
  return true
}

interface State {
  error: Error | null
}

/** Évite l'écran noir : recharge la nouvelle version si besoin, sinon affiche l'erreur et un moyen d'en sortir. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) reloadForNewVersion()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = isChunkLoadError(error)
    return (
      <div className="pt-safe mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl">{chunk ? '🔄' : '😕'}</div>
        <h1 className="text-xl font-bold">{chunk ? 'Nouvelle version disponible' : "Oups, quelque chose s'est mal passé"}</h1>
        <p className="text-sm text-zinc-400">
          {chunk ? "L'appli a été mise à jour. Recharge-la pour continuer." : "Recharge l'appli. Si le problème revient, envoie une capture de cet écran."}
        </p>
        {!chunk && <pre className="max-h-32 w-full overflow-auto rounded-xl bg-zinc-900 p-3 text-left text-xs whitespace-pre-wrap text-rose-300">{error.message}</pre>}
        <div className="flex gap-2">
          <button onClick={() => location.reload()} className="bg-gradient-accent rounded-xl px-5 py-3 font-semibold text-zinc-950">
            Recharger
          </button>
          <button
            onClick={() => {
              location.hash = '#/'
              location.reload()
            }}
            className="rounded-xl bg-zinc-800 px-5 py-3 font-medium"
          >
            Accueil
          </button>
        </div>
      </div>
    )
  }
}
