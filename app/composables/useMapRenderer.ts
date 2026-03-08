// Map Renderer Composable
// Converts AI-generated structures into actual nodes and edges

import type { Point, Node, NodeStyle, EdgeStyle } from '~/types/canvas'
import type {
  MapStructure,
  BranchStructure,
  RichNodeSuggestion
} from '~/types/ai-generation'
import { useMapStore } from '~/stores/mapStore'
import { getRelationshipLabel, getRelationshipColor } from '~/utils/ai-prompts'

/**
 * Layout configuration for map rendering
 */
interface LayoutConfig {
  /** Starting position for the root node */
  startPosition: Point
  /** Horizontal spacing between nodes */
  horizontalSpacing: number
  /** Vertical spacing between nodes */
  verticalSpacing: number
  /** Angle spread for radial layout (in radians) */
  radialSpread: number
  /** Minimum distance from center for first level */
  minRadius: number
}

const DEFAULT_LAYOUT: LayoutConfig = {
  startPosition: { x: 0, y: 0 },
  horizontalSpacing: 220,
  verticalSpacing: 120,
  radialSpread: Math.PI * 2,
  minRadius: 280
}

/**
 * Calculate total descendant count for a branch (for spacing)
 */
function countDescendants(branch: BranchStructure): number {
  let count = 1
  if (branch.children) {
    for (const child of branch.children) {
      count += countDescendants(child)
    }
  }
  return count
}

/**
 * Composable for rendering AI-generated map structures
 */
export function useMapRenderer() {
  const mapStore = useMapStore()

  /**
   * Category to color mapping
   */
  const categoryColors: Record<string, string> = {
    concept: '#60A5FA',   // Blue
    fact: '#4ADE80',      // Green
    question: '#FACC15',  // Yellow
    example: '#FB923C',   // Orange
    definition: '#A78BFA', // Purple
    process: '#F472B6'    // Pink
  }

  /**
   * Get color for a category
   */
  function getCategoryColor(category: string): string {
    return categoryColors[category] || '#00D2BE'
  }

  /**
   * Helper to create a node with partial style
   */
  function createNode(options: {
    position: Point
    content: string
    style?: Partial<NodeStyle>
    metadata?: Record<string, unknown>
  }): Node {
    return mapStore.addNode({
      position: options.position,
      content: options.content,
      style: options.style as NodeStyle,
      metadata: options.metadata
    })
  }

  /**
   * Helper to create an edge with optional label and style
   */
  function createEdge(
    sourceId: string,
    targetId: string,
    options?: { label?: string; style?: Partial<EdgeStyle> }
  ): { id: string } {
    const edge = mapStore.addEdge(sourceId, targetId, options?.style)

    // If label provided, update the edge to add label
    if (options?.label) {
      mapStore.updateEdge(edge.id, { label: options.label })
    }

    return edge
  }

  /**
   * Render a complete MapStructure into nodes and edges
   */
  function renderMapStructure(
    structure: MapStructure,
    startPosition: Point = { x: 0, y: 0 },
    config: Partial<LayoutConfig> = {}
  ): { rootNodeId: string; nodeIds: string[]; edgeIds: string[] } {
    const layout = { ...DEFAULT_LAYOUT, ...config, startPosition }
    const nodeIds: string[] = []
    const edgeIds: string[] = []

    // Create root node at center with larger styling
    const rootNode = createNode({
      position: startPosition,
      content: structure.rootTopic,
      style: { borderColor: '#00D2BE' },
      metadata: {
        description: structure.rootDescription,
        isRoot: true,
        category: 'concept'
      }
    })
    nodeIds.push(rootNode.id)

    // Calculate total weight for proportional spacing
    const branchCount = structure.branches.length
    const branchWeights = structure.branches.map(b => countDescendants(b))
    const totalWeight = branchWeights.reduce((sum, w) => sum + w, 0)

    // Use proportional angle allocation based on branch complexity
    let currentAngle = -Math.PI / 2 - (layout.radialSpread / 2) * 0.8

    structure.branches.forEach((branch, index) => {
      // Calculate angle span based on branch weight (more children = more space)
      const weight = branchWeights[index] ?? 1
      const angleSpan = (weight / totalWeight) * layout.radialSpread * 0.85

      // Position at the middle of this branch's allocated angle span
      const angle = currentAngle + angleSpan / 2
      currentAngle += angleSpan + 0.1 // Small gap between branches

      // Vary radius based on branch depth for visual interest
      const depthFactor = branch.children && branch.children.length > 2 ? 1.15 : 1
      const branchRadius = layout.minRadius * depthFactor

      const branchPosition = {
        x: startPosition.x + Math.cos(angle) * branchRadius,
        y: startPosition.y + Math.sin(angle) * branchRadius
      }

      const result = renderBranch(branch, branchPosition, rootNode.id, angle, layout, 1)
      nodeIds.push(...result.nodeIds)
      edgeIds.push(...result.edgeIds)
    })

    // Create cross-connections if present
    if (structure.crossConnections) {
      for (const connection of structure.crossConnections) {
        // Find nodes by title reference
        const sourceNode = findNodeByContent(connection.sourceRef, nodeIds)
        const targetNode = findNodeByContent(connection.targetRef, nodeIds)

        if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
          const edge = createEdge(sourceNode.id, targetNode.id, {
            label: connection.reason || getRelationshipLabel(connection.relationshipType),
            style: {
              strokeColor: getRelationshipColor(connection.relationshipType),
              dashArray: [5, 5]
            }
          })
          edgeIds.push(edge.id)
        }
      }
    }

    mapStore.resolveOverlaps(nodeIds)
    return { rootNodeId: rootNode.id, nodeIds, edgeIds }
  }

  /**
   * Find a node by its content (case-insensitive partial match)
   */
  function findNodeByContent(content: string, nodeIds: string[]): Node | undefined {
    const searchLower = content.toLowerCase()
    for (const nodeId of nodeIds) {
      const node = mapStore.nodes.get(nodeId)
      if (node && node.content.toLowerCase().includes(searchLower)) {
        return node
      }
    }
    return undefined
  }

  /**
   * Render a branch and its children recursively
   */
  function renderBranch(
    branch: BranchStructure,
    position: Point,
    parentId: string,
    parentAngle: number,
    layout: LayoutConfig,
    level: number
  ): { nodeIds: string[]; edgeIds: string[] } {
    const nodeIds: string[] = []
    const edgeIds: string[] = []

    // Create node for this branch
    const node = createNode({
      position,
      content: branch.title,
      style: { borderColor: getCategoryColor(branch.category) },
      metadata: {
        description: branch.description,
        category: branch.category
      }
    })
    nodeIds.push(node.id)

    // Create edge from parent
    const edge = mapStore.addEdge(parentId, node.id)
    edgeIds.push(edge.id)

    // Render children with adaptive layout
    if (branch.children && branch.children.length > 0) {
      const childCount = branch.children.length

      // Adaptive radius: closer for deep branches, further for wide branches
      const baseRadius = layout.minRadius * (0.55 / Math.sqrt(level))
      const childRadius = childCount > 3 ? baseRadius * 1.2 : baseRadius

      // Adaptive angle spread: wider for more children
      const baseAngleSpread = Math.PI * 0.7
      const childAngleSpread = Math.min(baseAngleSpread * (1 + childCount * 0.1), Math.PI * 1.2)

      // Calculate weights for proportional spacing if children have sub-children
      const childWeights: number[] = branch.children.map(c =>
        c.children && c.children.length > 0 ? 1.5 + c.children.length * 0.3 : 1
      )
      const totalWeight = childWeights.reduce((sum, w) => sum + w, 0)

      let currentAngle = parentAngle - childAngleSpread / 2

      branch.children.forEach((child, index) => {
        // Proportional angle allocation
        const weight = childWeights[index] ?? 1
        const angleSpan = (weight / totalWeight) * childAngleSpread
        const childAngle = currentAngle + angleSpan / 2
        currentAngle += angleSpan

        // Slight radius variation for visual interest
        const radiusVariation = 1 + (index % 2 === 0 ? 0.08 : -0.05)
        const finalRadius = childRadius * radiusVariation

        const childPosition = {
          x: position.x + Math.cos(childAngle) * finalRadius,
          y: position.y + Math.sin(childAngle) * finalRadius
        }

        const result = renderBranch(child, childPosition, node.id, childAngle, layout, level + 1)
        nodeIds.push(...result.nodeIds)
        edgeIds.push(...result.edgeIds)
      })
    }

    return { nodeIds, edgeIds }
  }

  /**
   * Render rich suggestions as nodes connected to a parent
   */
  function renderRichSuggestions(
    suggestions: RichNodeSuggestion[],
    parentNode: Node,
    options: {
      layout?: 'radial' | 'vertical' | 'horizontal'
      spacing?: number
      includeChildren?: boolean
    } = {}
  ): { nodeIds: string[]; edgeIds: string[] } {
    const {
      layout = 'horizontal',
      spacing = 80,
      includeChildren = true
    } = options

    const nodeIds: string[] = []
    const edgeIds: string[] = []

    suggestions.forEach((suggestion, index) => {
      let position: Point

      switch (layout) {
        case 'radial': {
          const angle = (index / suggestions.length) * Math.PI * 2 - Math.PI / 2
          const radius = 200
          position = {
            x: parentNode.position.x + Math.cos(angle) * radius,
            y: parentNode.position.y + Math.sin(angle) * radius
          }
          break
        }
        case 'vertical':
          position = {
            x: parentNode.position.x + parentNode.size.width + 100,
            y: parentNode.position.y + index * spacing
          }
          break
        case 'horizontal':
        default:
          position = {
            x: parentNode.position.x + parentNode.size.width + 100 + (index % 3) * 180,
            y: parentNode.position.y + Math.floor(index / 3) * spacing
          }
      }

      // Create node
      const node = createNode({
        position,
        content: suggestion.title,
        style: { borderColor: getCategoryColor(suggestion.category) },
        metadata: {
          description: suggestion.description,
          category: suggestion.category,
          relationshipToParent: suggestion.relationshipToParent,
          confidence: suggestion.confidence
        }
      })
      nodeIds.push(node.id)

      // Create edge with relationship label
      const edge = createEdge(parentNode.id, node.id, {
        label: suggestion.relationshipToParent
          ? getRelationshipLabel(suggestion.relationshipToParent)
          : undefined,
        style: suggestion.relationshipToParent
          ? { strokeColor: getRelationshipColor(suggestion.relationshipToParent) }
          : undefined
      })
      edgeIds.push(edge.id)

      // Render children if present and requested
      if (includeChildren && suggestion.suggestedChildren && suggestion.suggestedChildren.length > 0) {
        const childNode = mapStore.nodes.get(node.id)
        if (childNode) {
          const childResult = renderRichSuggestions(
            suggestion.suggestedChildren,
            childNode,
            { layout: 'vertical', spacing: spacing * 0.8, includeChildren }
          )
          nodeIds.push(...childResult.nodeIds)
          edgeIds.push(...childResult.edgeIds)
        }
      }
    })

    mapStore.resolveOverlaps(nodeIds)
    return { nodeIds, edgeIds }
  }

  /**
   * Add a single rich suggestion as a node
   */
  function addRichSuggestion(
    suggestion: RichNodeSuggestion,
    parentNode: Node,
    position?: Point
  ): { nodeId: string; edgeId: string } {
    const pos = position || {
      x: parentNode.position.x + parentNode.size.width + 100,
      y: parentNode.position.y
    }

    const node = createNode({
      position: pos,
      content: suggestion.title,
      style: { borderColor: getCategoryColor(suggestion.category) },
      metadata: {
        description: suggestion.description,
        category: suggestion.category,
        relationshipToParent: suggestion.relationshipToParent,
        confidence: suggestion.confidence
      }
    })

    const edge = createEdge(parentNode.id, node.id, {
      label: suggestion.relationshipToParent
        ? getRelationshipLabel(suggestion.relationshipToParent)
        : undefined,
      style: suggestion.relationshipToParent
        ? { strokeColor: getRelationshipColor(suggestion.relationshipToParent) }
        : undefined
    })

    return { nodeId: node.id, edgeId: edge.id }
  }

  /**
   * Calculate optimal position for a new node near a parent
   */
  function calculateSuggestionPosition(
    parentNode: Node,
    existingSuggestionCount: number
  ): Point {
    const baseX = parentNode.position.x + parentNode.size.width + 100
    const offsetY = existingSuggestionCount * 80

    return {
      x: baseX,
      y: parentNode.position.y + offsetY - (existingSuggestionCount * 40) // Center vertically
    }
  }

  return {
    renderMapStructure,
    renderRichSuggestions,
    addRichSuggestion,
    calculateSuggestionPosition,
    getCategoryColor,
    categoryColors
  }
}
