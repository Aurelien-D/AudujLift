import { parseNutritionLabel, type ParsedLabel } from './labelParser'

/**
 * Prépare la photo pour l'OCR : mise à l'échelle (~1800 px de large), niveaux de gris
 * et binarisation (seuil d'Otsu). Améliore nettement la lecture des petits caractères.
 */
async function preprocess(src: string): Promise<string> {
  const img = new Image()
  img.src = src
  await img.decode()
  const scale = Math.min(3, 1800 / img.width)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const gray = new Uint8Array(w * h)
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) {
    const g = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2])
    gray[i] = g
    hist[g]++
  }
  // Seuil d'Otsu
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = gray.length - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  // Texte clair sur fond foncé : on inverse pour obtenir du noir sur blanc
  const darkBackground = gray.filter((g) => g < threshold).length > gray.length / 2
  for (let i = 0; i < gray.length; i++) {
    const on = gray[i] > threshold !== darkBackground ? 255 : 0
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = on
  }
  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Lit le tableau nutritionnel sur une photo (OCR Tesseract, exécuté dans le navigateur).
 * Le moteur et les langues sont téléchargés au premier usage (~5 Mo), puis mis en cache.
 */
export async function readNutritionLabel(image: string, onProgress?: (p: number) => void): Promise<{ text: string; values: ParsedLabel }> {
  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker(['fra', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    // PSM 4 : une colonne de lignes de tailles variables — lit chaque ligne « libellé + valeur » d'un tableau
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
    const { data } = await worker.recognize(await preprocess(image))
    let text = data.text
    let values = parseNutritionLabel(text)
    if (Object.keys(values).length < 3) {
      // Repli : segmentation automatique sur l'image d'origine
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
      const second = await worker.recognize(image)
      const alt = parseNutritionLabel(second.data.text)
      if (Object.keys(alt).length > Object.keys(values).length) {
        text = second.data.text
        values = alt
      }
    }
    return { text, values }
  } finally {
    await worker.terminate()
  }
}
