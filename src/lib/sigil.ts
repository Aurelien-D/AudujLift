// Géométrie de l'emblème Dark Solar (soleil géométrique fracturé), partagée par le composant et le récap image.

/** Rayons : 12 lames effilées régulières (une longue toutes les trois), la structure reste symétrique. */
export const SIGIL_RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180
  const long = i % 3 === 0
  const r1 = 17
  const r2 = long ? 30 : 25.5
  const w = long ? 2.6 : 2
  const p = (r: number, da: number) => [32 + r * Math.sin(a + da), 32 - r * Math.cos(a + da)]
  const [x1, y1] = p(r1, -w / r1)
  const [x2, y2] = p(r1, w / r1)
  const [x3, y3] = p(r2, 0)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x3.toFixed(2)} ${y3.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}Z`
}).join('')

/** Faille qui traverse le soleil : la signature « chevalier solaire déchu », discrète. */
export const SIGIL_FRACTURE = 'M45 4 L35.5 25 L40 29.5 L27 47 L30.5 50 L21 62'

/** Emblème en SVG autonome (pour un dessin sur canvas). */
export function sigilSvg(color: string, size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><mask id="m"><rect width="64" height="64" fill="#fff"/><path d="${SIGIL_FRACTURE}" fill="none" stroke="#000" stroke-width="2.6"/></mask></defs><g mask="url(#m)" fill="${color}"><path d="${SIGIL_RAYS}"/><circle cx="32" cy="32" r="12.5"/><circle cx="32" cy="32" r="15" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.55"/></g></svg>`
}
