import { Flashlight, Keyboard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { Button, inputClass, Sheet } from './ui'

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): NativeDetector
      getSupportedFormats(): Promise<string[]>
    }
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/**
 * Scanner de code-barres via la caméra.
 * Utilise l'API native BarcodeDetector (Chrome / Android) et bascule sur ZXing (iOS / Firefox).
 */
export function BarcodeScanner({ open, onClose, onDetected }: { open: boolean; onClose: () => void; onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [torch, setTorch] = useState<boolean | null>(null)
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  useEffect(() => {
    if (!open || manual) return
    let stopped = false
    let stream: MediaStream | undefined
    let raf = 0
    let zxingStop: (() => void) | undefined

    const found = (value: string) => {
      if (stopped) return
      stopped = true
      navigator.vibrate?.(60)
      onDetectedRef.current(value)
    }

    ;(async () => {
      try {
        setError(null)
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("La caméra n'est pas accessible (HTTPS requis).")
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean }
        setTorch(caps.torch ? false : null)
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        const native = window.BarcodeDetector && (await window.BarcodeDetector.getSupportedFormats()).includes('ean_13')
        if (native) {
          const detector = new window.BarcodeDetector!({ formats: FORMATS })
          const loop = async () => {
            if (stopped) return
            try {
              const codes = await detector.detect(video)
              if (codes[0]?.rawValue) return found(codes[0].rawValue)
            } catch {
              /* image pas encore prête */
            }
            raf = requestAnimationFrame(loop)
          }
          loop()
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
          const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]])
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
          const controls = await reader.decodeFromStream(stream, video, (result) => {
            if (result) found(result.getText())
          })
          zxingStop = () => controls.stop()
          if (stopped) zxingStop()
        }
      } catch (e) {
        const err = e as Error
        setError(err.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur.' : err.message || 'Caméra indisponible')
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      zxingStop?.()
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
    }
  }, [open, manual])

  const toggleTorch = async () => {
    const t = trackRef.current
    if (!t) return
    const next = !torch
    try {
      await t.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch {
      setTorch(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Scanner un code-barres">
      {manual ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim().length >= 6) onDetected(code.trim())
          }}
          className="space-y-3"
        >
          <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="Ex. 3017620422003" className={inputClass} />
          <Button variant="primary" size="lg" className="w-full" disabled={code.length < 6}>
            Rechercher
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setManual(false)}>
            Revenir à la caméra
          </Button>
        </form>
      ) : (
        <>
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-32 w-4/5 rounded-2xl border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-danger/80" />
              </div>
            </div>
            {error && <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-danger">{error}</div>}
            {torch !== null && (
              <button onClick={toggleTorch} aria-label="Lampe" className={cn('absolute right-3 bottom-3 rounded-full p-3', torch ? 'bg-warn text-ink' : 'bg-black/60 text-white')}>
                <Flashlight size={20} />
              </button>
            )}
          </div>
          <p className="mt-3 text-center text-sm text-silver">Place le code-barres dans le cadre</p>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setManual(true)}>
            <Keyboard size={18} /> Saisir le code à la main
          </Button>
        </>
      )}
    </Sheet>
  )
}
