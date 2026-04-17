/** Linear interpolation between two hex colors */
export function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (hex: string) => {
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!
    return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)]
  }
  try {
    const [r1, g1, b1] = parseHex(a)
    const [r2, g2, b2] = parseHex(b)
    const r = Math.round(r1! + (r2! - r1!) * t)
    const g = Math.round(g1! + (g2! - g1!) * t)
    const blue = Math.round(b1! + (b2! - b1!) * t)
    return `rgb(${r},${g},${blue})`
  } catch {
    return t > 0.5 ? b : a
  }
}
