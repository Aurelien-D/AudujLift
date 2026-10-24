import { useEffect } from 'react'

/** Garde l'écran allumé tant que `enabled` est vrai (re-demandé au retour sur l'appli). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      if (cancelled || lock || document.visibilityState !== 'visible') return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) return void l.release()
        lock = l
        l.addEventListener('release', () => {
          if (lock === l) lock = null
        })
      } catch {
        /* refusé (économie d'énergie…) : sans conséquence */
      }
    }
    void acquire()
    const onVisible = () => void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [enabled])
}
