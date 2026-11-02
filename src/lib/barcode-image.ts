// Lecture d'un code-barres sur une photo déjà prise (et non sur le flux de la caméra) : gratuite, sur l'appareil.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

export async function decodeBarcodeFromImage(dataUrl: string): Promise<string | null> {
  const valid = (code?: string | null) => (code && /^\d{8,14}$/.test(code) ? code : null)
  try {
    if (window.BarcodeDetector && (await window.BarcodeDetector.getSupportedFormats()).includes('ean_13')) {
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      const codes = await new window.BarcodeDetector({ formats: FORMATS }).detect(img)
      return valid(codes[0]?.rawValue)
    }
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
    const hints = new Map<number, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
      [DecodeHintType.TRY_HARDER, true],
    ])
    const result = await new BrowserMultiFormatReader(hints).decodeFromImageUrl(dataUrl)
    return valid(result.getText())
  } catch {
    // Aucun code-barres lisible sur la photo (cas normal pour la face avant d'un paquet)
    return null
  }
}
