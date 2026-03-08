// QuadTree spatial index for viewport culling
// Max 8 items per leaf, max depth 8

export interface QTRect {
  x: number
  y: number
  width: number
  height: number
}

export interface QTItem {
  id: string
  rect: QTRect
}

const MAX_ITEMS = 8
const MAX_DEPTH = 8

export class QuadTree {
  private bounds: QTRect
  private depth: number
  private items: QTItem[] = []
  private children: QuadTree[] | null = null

  constructor(bounds: QTRect, depth: number = 0) {
    this.bounds = bounds
    this.depth = depth
  }

  clear() {
    this.items = []
    this.children = null
  }

  insert(item: QTItem): boolean {
    if (!this.intersects(this.bounds, item.rect)) {
      return false
    }

    if (this.children === null) {
      this.items.push(item)
      if (this.items.length > MAX_ITEMS && this.depth < MAX_DEPTH) {
        this.subdivide()
      }
      return true
    }

    for (const child of this.children) {
      child.insert(item)
    }
    return true
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex(i => i.id === id)
    if (idx !== -1) {
      this.items.splice(idx, 1)
      return true
    }

    if (this.children) {
      for (const child of this.children) {
        if (child.remove(id)) return true
      }
    }

    return false
  }

  /**
   * Query all items that overlap the given rectangle
   */
  queryRect(rect: QTRect, result: Set<string> = new Set()): Set<string> {
    if (!this.intersects(this.bounds, rect)) {
      return result
    }

    for (const item of this.items) {
      if (this.intersects(item.rect, rect)) {
        result.add(item.id)
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.queryRect(rect, result)
      }
    }

    return result
  }

  private subdivide() {
    const { x, y, width, height } = this.bounds
    const hw = width / 2
    const hh = height / 2
    const nextDepth = this.depth + 1

    this.children = [
      new QuadTree({ x, y, width: hw, height: hh }, nextDepth),
      new QuadTree({ x: x + hw, y, width: hw, height: hh }, nextDepth),
      new QuadTree({ x, y: y + hh, width: hw, height: hh }, nextDepth),
      new QuadTree({ x: x + hw, y: y + hh, width: hw, height: hh }, nextDepth)
    ]

    // Re-insert existing items into children
    for (const item of this.items) {
      for (const child of this.children) {
        child.insert(item)
      }
    }
    this.items = []
  }

  private intersects(a: QTRect, b: QTRect): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }
}
