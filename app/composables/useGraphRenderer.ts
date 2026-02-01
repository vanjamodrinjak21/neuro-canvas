// D3.js Force-Directed Graph Renderer for NeuroCanvas
// Renders the graph view with physics simulation

import * as d3 from 'd3'
import type { Ref } from 'vue'
import type { GraphNode, GraphEdge, GraphViewOptions } from '~/types/canvas'

export interface GraphRendererCallbacks {
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
  onNodeDrag?: (nodeId: string, x: number, y: number) => void
}

export function useGraphRenderer(
  containerRef: Ref<HTMLElement | null>,
  callbacks: GraphRendererCallbacks = {}
) {
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  let simulation: d3.Simulation<GraphNode, GraphEdge> | null = null
  let zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
  let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null

  const width = ref(800)
  const height = ref(600)
  const hoveredNodeId = ref<string | null>(null)
  const selectedNodeId = ref<string | null>(null)

  // Graph data
  const nodes = ref<GraphNode[]>([])
  const edges = ref<GraphEdge[]>([])

  /**
   * Initialize the SVG container and zoom behavior
   */
  function initialize(containerWidth: number, containerHeight: number): void {
    if (!containerRef.value) return

    width.value = containerWidth
    height.value = containerHeight

    // Clear any existing content
    d3.select(containerRef.value).selectAll('*').remove()

    // Create SVG
    svg = d3.select(containerRef.value)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
      .style('background', 'transparent')

    // Create container group for zooming
    g = svg.append('g')

    // Add zoom behavior
    zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g?.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Add arrow marker definition
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-5 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M-5,-5 L5,0 L-5,5')
      .attr('fill', 'var(--nc-ink-muted)')

    // Add glow filter
    const defs = svg.select('defs')
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur')

    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')
  }

  /**
   * Update graph data and restart simulation
   */
  function updateData(newNodes: GraphNode[], newEdges: GraphEdge[]): void {
    if (!svg || !g) return

    nodes.value = newNodes
    edges.value = newEdges

    // Stop existing simulation
    if (simulation) {
      simulation.stop()
    }

    // Create force simulation
    simulation = d3.forceSimulation<GraphNode, GraphEdge>(newNodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(newEdges)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody<GraphNode>().strength(-300))
      .force('center', d3.forceCenter(width.value / 2, height.value / 2).strength(0.1))
      .force('collision', d3.forceCollide<GraphNode>().radius(40))

    // Clear existing elements
    g.selectAll('.link').remove()
    g.selectAll('.node').remove()

    // Draw edges
    const link = g.selectAll<SVGLineElement, GraphEdge>('.link')
      .data(newEdges)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', 'var(--nc-border)')
      .attr('stroke-width', d => Math.max(1, d.weight))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)')

    // Draw nodes
    const node = g.selectAll<SVGGElement, GraphNode>('.node')
      .data(newNodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(drag(simulation))

    // Node circles
    node.append('circle')
      .attr('r', d => Math.max(15, Math.min(30, 15 + d.connections * 2)))
      .attr('fill', d => d.color || 'var(--nc-surface-3)')
      .attr('stroke', 'var(--nc-border)')
      .attr('stroke-width', 2)

    // Node labels
    node.append('text')
      .text(d => truncateLabel(d.label, 15))
      .attr('text-anchor', 'middle')
      .attr('dy', d => Math.max(15, Math.min(30, 15 + d.connections * 2)) + 15)
      .attr('fill', 'var(--nc-ink-soft)')
      .attr('font-size', '12px')
      .attr('font-family', 'var(--nc-font-display)')

    // Node interactions
    node
      .on('mouseenter', (event, d) => {
        hoveredNodeId.value = d.id
        highlightNode(d.id)
        callbacks.onNodeHover?.(d.id)
      })
      .on('mouseleave', () => {
        hoveredNodeId.value = null
        clearHighlight()
        callbacks.onNodeHover?.(null)
      })
      .on('click', (_, d) => {
        selectedNodeId.value = d.id
        callbacks.onNodeClick?.(d.id)
      })

    // Simulation tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0)

      node.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
    })
  }

  /**
   * Create drag behavior for nodes
   */
  function drag(sim: d3.Simulation<GraphNode, GraphEdge>) {
    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) sim.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
      callbacks.onNodeDrag?.(event.subject.id, event.x, event.y)
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) sim.alphaTarget(0)
      // Unpin node unless shift is held
      if (!event.sourceEvent.shiftKey) {
        event.subject.fx = null
        event.subject.fy = null
      }
    }

    return d3.drag<SVGGElement, GraphNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
  }

  /**
   * Update physics parameters
   */
  function setPhysics(options: GraphViewOptions['physics']): void {
    if (!simulation) return

    simulation
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges.value)
        .id(d => d.id)
        .distance(options.linkDistance))
      .force('charge', d3.forceManyBody<GraphNode>().strength(options.repulsionStrength))
      .force('center', d3.forceCenter(width.value / 2, height.value / 2).strength(options.centerForce))
      .force('collision', d3.forceCollide<GraphNode>().radius(options.collisionRadius))

    simulation.alpha(0.5).restart()
  }

  /**
   * Highlight a node and its connections
   */
  function highlightNode(nodeId: string): void {
    if (!g) return

    // Get connected node IDs
    const connectedIds = new Set<string>([nodeId])
    edges.value.forEach(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id

      if (sourceId === nodeId) connectedIds.add(targetId)
      if (targetId === nodeId) connectedIds.add(sourceId)
    })

    // Dim unconnected nodes
    g.selectAll<SVGGElement, GraphNode>('.node')
      .style('opacity', d => connectedIds.has(d.id) ? 1 : 0.2)
      .select('circle')
      .attr('filter', d => d.id === nodeId ? 'url(#glow)' : null)

    // Dim unconnected edges
    g.selectAll<SVGLineElement, GraphEdge>('.link')
      .style('opacity', d => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id
        const targetId = typeof d.target === 'string' ? d.target : d.target.id
        return (sourceId === nodeId || targetId === nodeId) ? 1 : 0.1
      })
      .attr('stroke', d => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id
        const targetId = typeof d.target === 'string' ? d.target : d.target.id
        return (sourceId === nodeId || targetId === nodeId) ? 'var(--nc-accent)' : 'var(--nc-border)'
      })
  }

  /**
   * Clear node highlighting
   */
  function clearHighlight(): void {
    if (!g) return

    g.selectAll('.node')
      .style('opacity', 1)
      .select('circle')
      .attr('filter', null)

    g.selectAll('.link')
      .style('opacity', 0.6)
      .attr('stroke', 'var(--nc-border)')
  }

  /**
   * Center view on a specific node
   */
  function centerOnNode(nodeId: string): void {
    if (!svg || !zoom) return

    const node = nodes.value.find(n => n.id === nodeId)
    if (!node || node.x === undefined || node.y === undefined) return

    const transform = d3.zoomIdentity
      .translate(width.value / 2 - node.x, height.value / 2 - node.y)
      .scale(1)

    svg.transition()
      .duration(750)
      .call(zoom.transform, transform)
  }

  /**
   * Zoom to fit all nodes in view
   */
  function zoomToFit(padding: number = 50): void {
    if (!svg || !zoom || nodes.value.length === 0) return

    // Calculate bounds
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.value.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x)
        minY = Math.min(minY, node.y)
        maxX = Math.max(maxX, node.x)
        maxY = Math.max(maxY, node.y)
      }
    })

    const graphWidth = maxX - minX
    const graphHeight = maxY - minY

    const scale = Math.min(
      (width.value - padding * 2) / graphWidth,
      (height.value - padding * 2) / graphHeight,
      2 // Max scale
    )

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const transform = d3.zoomIdentity
      .translate(width.value / 2 - centerX * scale, height.value / 2 - centerY * scale)
      .scale(scale)

    svg.transition()
      .duration(750)
      .call(zoom.transform, transform)
  }

  /**
   * Reset zoom to default
   */
  function resetZoom(): void {
    if (!svg || !zoom) return

    svg.transition()
      .duration(500)
      .call(zoom.transform, d3.zoomIdentity)
  }

  /**
   * Cleanup resources
   */
  function destroy(): void {
    if (simulation) {
      simulation.stop()
      simulation = null
    }

    if (containerRef.value) {
      d3.select(containerRef.value).selectAll('*').remove()
    }

    svg = null
    g = null
    zoom = null
  }

  /**
   * Truncate label text
   */
  function truncateLabel(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }

  // Cleanup on unmount
  onUnmounted(() => {
    destroy()
  })

  return {
    // State
    hoveredNodeId: readonly(hoveredNodeId),
    selectedNodeId: readonly(selectedNodeId),
    nodes: readonly(nodes),
    edges: readonly(edges),

    // Methods
    initialize,
    updateData,
    setPhysics,
    highlightNode,
    clearHighlight,
    centerOnNode,
    zoomToFit,
    resetZoom,
    destroy
  }
}
