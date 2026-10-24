import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { reloadForNewVersion } from './components/ErrorBoundary'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './index.css'

// Mises à jour : la nouvelle version s'installe et l'appli se recharge automatiquement.
// Vérifie aussi régulièrement s'il y en a une quand l'appli reste ouverte longtemps.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 30 * 60 * 1000)
  },
})

// Un fichier de l'ancienne version a disparu du serveur : on recharge sur la nouvelle
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
