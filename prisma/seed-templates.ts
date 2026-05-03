import { PrismaClient } from '../server/generated/prisma'

const prisma = new PrismaClient()

interface SeedNode {
  id: string
  type: 'text'
  position: { x: number; y: number }
  size: { width: number; height: number }
  content: string
  style: {
    shape: 'rounded' | 'circle' | 'diamond'
    fillColor: string
    borderColor: string
    borderWidth: number
    textColor: string
    fontSize: number
    fontWeight: number
    shadowEnabled: boolean
    glowEnabled: boolean
  }
  isRoot?: boolean
  parentId?: string
  createdAt: number
  updatedAt: number
}

interface SeedEdge {
  id: string
  sourceId: string
  targetId: string
  style: {
    type: 'bezier'
    strokeColor: string
    strokeWidth: number
    arrowStart: 'none'
    arrowEnd: 'arrow'
    animated: boolean
  }
  createdAt: number
  updatedAt: number
}

function makeNode(
  id: string,
  content: string,
  x: number,
  y: number,
  opts: Partial<SeedNode['style']> & { isRoot?: boolean; width?: number } = {}
): SeedNode {
  const now = Date.now()
  return {
    id,
    type: 'text',
    position: { x, y },
    size: { width: opts.width || (opts.isRoot ? 140 : 120), height: opts.isRoot ? 44 : 36 },
    content,
    style: {
      shape: opts.shape || 'rounded',
      fillColor: opts.fillColor || '#1A1A1E',
      borderColor: opts.borderColor || '#2A2A30',
      borderWidth: opts.isRoot ? 2 : 1,
      textColor: opts.textColor || '#E8E8EC',
      fontSize: opts.isRoot ? 15 : 13,
      fontWeight: opts.isRoot ? 700 : 500,
      shadowEnabled: false,
      glowEnabled: false,
    },
    isRoot: opts.isRoot,
    createdAt: now,
    updatedAt: now,
  }
}

function makeEdge(id: string, sourceId: string, targetId: string, color = '#2A2A30'): SeedEdge {
  const now = Date.now()
  return {
    id,
    sourceId,
    targetId,
    style: {
      type: 'bezier',
      strokeColor: color,
      strokeWidth: 1.5,
      arrowStart: 'none',
      arrowEnd: 'arrow',
      animated: false,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function toRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map(i => [i.id, i]))
}

function generatePreview(nodes: SeedNode[]): { shapes: any[]; width: number; height: number } {
  const previewW = 270, previewH = 140, padding = 20
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + n.size.width)
    maxY = Math.max(maxY, n.position.y + n.size.height)
  }
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const shapes = nodes.slice(0, 12).map(n => {
    const relX = (n.position.x - minX) / rangeX
    const relY = (n.position.y - minY) / rangeY
    return {
      x: padding + relX * (previewW - padding * 2 - 40),
      y: padding + relY * (previewH - padding * 2 - 20),
      width: n.isRoot ? 48 : 28,
      height: n.isRoot ? 20 : 16,
      color: n.style.fillColor,
      borderColor: n.style.borderColor,
      borderRadius: 4,
      label: n.isRoot ? n.content.slice(0, 8) : undefined,
      fontSize: n.isRoot ? 7 : undefined,
    }
  })
  return { shapes, width: previewW, height: previewH }
}

// ── Template 1: SWOT Analysis ──
function swotAnalysis() {
  const nodes: SeedNode[] = [
    makeNode('swot-root', 'SWOT', 370, 40, { isRoot: true, fillColor: '#0F3D38', borderColor: '#00D2BE', textColor: '#00D2BE' }),
    makeNode('swot-s', 'Strengths', 180, 140, { fillColor: '#0F2E1F', borderColor: '#22C55E', textColor: '#22C55E' }),
    makeNode('swot-w', 'Weaknesses', 560, 140, { fillColor: '#2E1F1F', borderColor: '#EF4444', textColor: '#EF4444' }),
    makeNode('swot-o', 'Opportunities', 180, 300, { fillColor: '#1A2040', borderColor: '#3B82F6', textColor: '#3B82F6', width: 140 }),
    makeNode('swot-t', 'Threats', 560, 300, { fillColor: '#2E2A1F', borderColor: '#F59E0B', textColor: '#F59E0B' }),
    makeNode('swot-s1', 'Strength 1', 100, 220, { fillColor: '#152318' }),
    makeNode('swot-s2', 'Strength 2', 260, 220, { fillColor: '#152318' }),
    makeNode('swot-w1', 'Weakness 1', 480, 220, { fillColor: '#231515' }),
    makeNode('swot-w2', 'Weakness 2', 640, 220, { fillColor: '#231515' }),
    makeNode('swot-o1', 'Opportunity 1', 100, 380, { fillColor: '#151A28', width: 130 }),
    makeNode('swot-o2', 'Opportunity 2', 260, 380, { fillColor: '#151A28', width: 130 }),
    makeNode('swot-t1', 'Threat 1', 480, 380, { fillColor: '#231F15' }),
    makeNode('swot-t2', 'Threat 2', 640, 380, { fillColor: '#231F15' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-swot-s', 'swot-root', 'swot-s', '#22C55E'),
    makeEdge('e-swot-w', 'swot-root', 'swot-w', '#EF4444'),
    makeEdge('e-swot-o', 'swot-root', 'swot-o', '#3B82F6'),
    makeEdge('e-swot-t', 'swot-root', 'swot-t', '#F59E0B'),
    makeEdge('e-s1', 'swot-s', 'swot-s1', '#22C55E'),
    makeEdge('e-s2', 'swot-s', 'swot-s2', '#22C55E'),
    makeEdge('e-w1', 'swot-w', 'swot-w1', '#EF4444'),
    makeEdge('e-w2', 'swot-w', 'swot-w2', '#EF4444'),
    makeEdge('e-o1', 'swot-o', 'swot-o1', '#3B82F6'),
    makeEdge('e-o2', 'swot-o', 'swot-o2', '#3B82F6'),
    makeEdge('e-t1', 'swot-t', 'swot-t1', '#F59E0B'),
    makeEdge('e-t2', 'swot-t', 'swot-t2', '#F59E0B'),
  ]
  return {
    slug: 'swot-analysis', title: 'SWOT Analysis',
    description: 'Analyze your project, product, or business using the SWOT framework. Identify internal strengths and weaknesses, then map external opportunities and threats. AI adapts the structure to your specific topic.',
    category: 'business' as const, tags: ['strategy', 'analysis', 'planning', 'competitive'],
    aiEnhanced: true, nodes, edges, nodeCount: 13, levelCount: 3,
  }
}

// ── Template 2: Brainstorm ──
function brainstorm() {
  const nodes: SeedNode[] = [
    makeNode('brain-root', 'Idea', 370, 40, { isRoot: true, fillColor: '#2E2A1F', borderColor: '#F59E0B', textColor: '#F59E0B' }),
    makeNode('brain-a', 'Branch A', 150, 150, { fillColor: '#1F2E2A', borderColor: '#34D399', textColor: '#34D399' }),
    makeNode('brain-b', 'Branch B', 370, 150, { fillColor: '#2A1F2E', borderColor: '#A78BFA', textColor: '#A78BFA' }),
    makeNode('brain-c', 'Branch C', 590, 150, { fillColor: '#1F252E', borderColor: '#60A5FA', textColor: '#60A5FA' }),
    makeNode('brain-a1', 'Thought 1', 70, 250, { fillColor: '#162320' }),
    makeNode('brain-a2', 'Thought 2', 230, 250, { fillColor: '#162320' }),
    makeNode('brain-b1', 'Thought 3', 290, 250, { fillColor: '#201623' }),
    makeNode('brain-b2', 'Thought 4', 450, 250, { fillColor: '#201623' }),
    makeNode('brain-c1', 'Thought 5', 510, 250, { fillColor: '#161D23' }),
    makeNode('brain-c2', 'Thought 6', 670, 250, { fillColor: '#161D23' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-ba', 'brain-root', 'brain-a', '#34D399'),
    makeEdge('e-bb', 'brain-root', 'brain-b', '#A78BFA'),
    makeEdge('e-bc', 'brain-root', 'brain-c', '#60A5FA'),
    makeEdge('e-a1', 'brain-a', 'brain-a1', '#34D399'),
    makeEdge('e-a2', 'brain-a', 'brain-a2', '#34D399'),
    makeEdge('e-b1', 'brain-b', 'brain-b1', '#A78BFA'),
    makeEdge('e-b2', 'brain-b', 'brain-b2', '#A78BFA'),
    makeEdge('e-c1', 'brain-c', 'brain-c1', '#60A5FA'),
    makeEdge('e-c2', 'brain-c', 'brain-c2', '#60A5FA'),
  ]
  return {
    slug: 'brainstorm', title: 'Brainstorm',
    description: 'Free-form idea generation with radial branches. Start with a central idea and expand outward with related thoughts and concepts.',
    category: 'creative' as const, tags: ['ideation', 'creative', 'brainstorming', 'freeform'],
    aiEnhanced: false, nodes, edges, nodeCount: 10, levelCount: 3,
  }
}

// ── Template 3: Study Notes ──
function studyNotes() {
  const nodes: SeedNode[] = [
    makeNode('study-root', 'Subject', 370, 40, { isRoot: true, fillColor: '#1A2040', borderColor: '#3B82F6', textColor: '#3B82F6' }),
    makeNode('study-concepts', 'Key Concepts', 150, 140, { fillColor: '#152238', borderColor: '#60A5FA', textColor: '#60A5FA', width: 130 }),
    makeNode('study-details', 'Details', 370, 140, { fillColor: '#152238', borderColor: '#60A5FA', textColor: '#60A5FA' }),
    makeNode('study-summary', 'Summary', 590, 140, { fillColor: '#152238', borderColor: '#60A5FA', textColor: '#60A5FA' }),
    makeNode('study-c1', 'Concept 1', 80, 230, { fillColor: '#111828' }),
    makeNode('study-c2', 'Concept 2', 220, 230, { fillColor: '#111828' }),
    makeNode('study-d1', 'Detail 1', 300, 230, { fillColor: '#111828' }),
    makeNode('study-d2', 'Detail 2', 440, 230, { fillColor: '#111828' }),
    makeNode('study-s1', 'Key Point', 530, 230, { fillColor: '#111828' }),
    makeNode('study-s2', 'Conclusion', 660, 230, { fillColor: '#111828' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-sc', 'study-root', 'study-concepts', '#60A5FA'),
    makeEdge('e-sd', 'study-root', 'study-details', '#60A5FA'),
    makeEdge('e-ss', 'study-root', 'study-summary', '#60A5FA'),
    makeEdge('e-c1', 'study-concepts', 'study-c1', '#3B82F6'),
    makeEdge('e-c2', 'study-concepts', 'study-c2', '#3B82F6'),
    makeEdge('e-d1', 'study-details', 'study-d1', '#3B82F6'),
    makeEdge('e-d2', 'study-details', 'study-d2', '#3B82F6'),
    makeEdge('e-s1', 'study-summary', 'study-s1', '#3B82F6'),
    makeEdge('e-s2', 'study-summary', 'study-s2', '#3B82F6'),
  ]
  return {
    slug: 'study-notes', title: 'Study Notes',
    description: 'Hierarchical topic breakdown with key concepts and details. Organize your learning material into structured, reviewable sections.',
    category: 'education' as const, tags: ['education', 'study', 'notes', 'learning'],
    aiEnhanced: true, nodes, edges, nodeCount: 10, levelCount: 3,
  }
}

// ── Template 4: Project Plan ──
function projectPlan() {
  const nodes: SeedNode[] = [
    makeNode('proj-root', 'Goal', 370, 40, { isRoot: true, fillColor: '#1F1A2E', borderColor: '#8B5CF6', textColor: '#8B5CF6' }),
    makeNode('proj-p1', 'Phase 1', 100, 140, { fillColor: '#1A1530', borderColor: '#A78BFA', textColor: '#A78BFA' }),
    makeNode('proj-p2', 'Phase 2', 290, 140, { fillColor: '#1A1530', borderColor: '#A78BFA', textColor: '#A78BFA' }),
    makeNode('proj-p3', 'Phase 3', 480, 140, { fillColor: '#1A1530', borderColor: '#A78BFA', textColor: '#A78BFA' }),
    makeNode('proj-p4', 'Phase 4', 660, 140, { fillColor: '#1A1530', borderColor: '#A78BFA', textColor: '#A78BFA' }),
    makeNode('proj-t1', 'Task 1.1', 40, 230, { fillColor: '#141020' }),
    makeNode('proj-t2', 'Task 1.2', 160, 230, { fillColor: '#141020' }),
    makeNode('proj-t3', 'Task 2.1', 230, 230, { fillColor: '#141020' }),
    makeNode('proj-t4', 'Task 2.2', 350, 230, { fillColor: '#141020' }),
    makeNode('proj-t5', 'Task 3.1', 420, 230, { fillColor: '#141020' }),
    makeNode('proj-t6', 'Task 3.2', 540, 230, { fillColor: '#141020' }),
    makeNode('proj-t7', 'Task 4.1', 600, 230, { fillColor: '#141020' }),
    makeNode('proj-t8', 'Task 4.2', 720, 230, { fillColor: '#141020' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-pp1', 'proj-root', 'proj-p1', '#A78BFA'),
    makeEdge('e-pp2', 'proj-root', 'proj-p2', '#A78BFA'),
    makeEdge('e-pp3', 'proj-root', 'proj-p3', '#A78BFA'),
    makeEdge('e-pp4', 'proj-root', 'proj-p4', '#A78BFA'),
    makeEdge('e-t1', 'proj-p1', 'proj-t1', '#8B5CF6'),
    makeEdge('e-t2', 'proj-p1', 'proj-t2', '#8B5CF6'),
    makeEdge('e-t3', 'proj-p2', 'proj-t3', '#8B5CF6'),
    makeEdge('e-t4', 'proj-p2', 'proj-t4', '#8B5CF6'),
    makeEdge('e-t5', 'proj-p3', 'proj-t5', '#8B5CF6'),
    makeEdge('e-t6', 'proj-p3', 'proj-t6', '#8B5CF6'),
    makeEdge('e-t7', 'proj-p4', 'proj-t7', '#8B5CF6'),
    makeEdge('e-t8', 'proj-p4', 'proj-t8', '#8B5CF6'),
  ]
  return {
    slug: 'project-plan', title: 'Project Plan',
    description: 'Phased project breakdown with tasks and milestones. Structure your project into clear phases with actionable tasks.',
    category: 'planning' as const, tags: ['project', 'planning', 'tasks', 'milestones'],
    aiEnhanced: false, nodes, edges, nodeCount: 13, levelCount: 3,
  }
}

// ── Template 5: Competitor Analysis ──
function competitorAnalysis() {
  const nodes: SeedNode[] = [
    makeNode('comp-root', 'Market', 370, 40, { isRoot: true, fillColor: '#0F3D38', borderColor: '#00D2BE', textColor: '#00D2BE' }),
    makeNode('comp-a', 'Competitor A', 100, 150, { fillColor: '#0F2D28', borderColor: '#2DD4BF', textColor: '#2DD4BF', width: 130 }),
    makeNode('comp-b', 'Competitor B', 310, 150, { fillColor: '#0F2D28', borderColor: '#2DD4BF', textColor: '#2DD4BF', width: 130 }),
    makeNode('comp-c', 'Competitor C', 520, 150, { fillColor: '#0F2D28', borderColor: '#2DD4BF', textColor: '#2DD4BF', width: 130 }),
    makeNode('comp-d', 'Competitor D', 720, 150, { fillColor: '#0F2D28', borderColor: '#2DD4BF', textColor: '#2DD4BF', width: 130 }),
    makeNode('comp-a1', 'Features', 40, 250, { fillColor: '#0C201D' }),
    makeNode('comp-a2', 'Pricing', 160, 250, { fillColor: '#0C201D' }),
    makeNode('comp-b1', 'Features', 250, 250, { fillColor: '#0C201D' }),
    makeNode('comp-b2', 'Pricing', 370, 250, { fillColor: '#0C201D' }),
    makeNode('comp-c1', 'Features', 460, 250, { fillColor: '#0C201D' }),
    makeNode('comp-c2', 'Pricing', 580, 250, { fillColor: '#0C201D' }),
    makeNode('comp-d1', 'Features', 660, 250, { fillColor: '#0C201D' }),
    makeNode('comp-d2', 'Pricing', 780, 250, { fillColor: '#0C201D' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-ca', 'comp-root', 'comp-a', '#2DD4BF'),
    makeEdge('e-cb', 'comp-root', 'comp-b', '#2DD4BF'),
    makeEdge('e-cc', 'comp-root', 'comp-c', '#2DD4BF'),
    makeEdge('e-cd', 'comp-root', 'comp-d', '#2DD4BF'),
    makeEdge('e-ca1', 'comp-a', 'comp-a1', '#0D9488'),
    makeEdge('e-ca2', 'comp-a', 'comp-a2', '#0D9488'),
    makeEdge('e-cb1', 'comp-b', 'comp-b1', '#0D9488'),
    makeEdge('e-cb2', 'comp-b', 'comp-b2', '#0D9488'),
    makeEdge('e-cc1', 'comp-c', 'comp-c1', '#0D9488'),
    makeEdge('e-cc2', 'comp-c', 'comp-c2', '#0D9488'),
    makeEdge('e-cd1', 'comp-d', 'comp-d1', '#0D9488'),
    makeEdge('e-cd2', 'comp-d', 'comp-d2', '#0D9488'),
  ]
  return {
    slug: 'competitor-analysis', title: 'Competitor Analysis',
    description: 'Compare competitors across features, pricing, and positioning. Map the competitive landscape to identify opportunities.',
    category: 'business' as const, tags: ['competition', 'market', 'analysis', 'business'],
    aiEnhanced: true, nodes, edges, nodeCount: 13, levelCount: 3,
  }
}

// ── Template 6: Research Paper ──
function researchPaper() {
  const nodes: SeedNode[] = [
    makeNode('res-root', 'Thesis', 370, 40, { isRoot: true, fillColor: '#2E1F1F', borderColor: '#EF4444', textColor: '#EF4444' }),
    makeNode('res-abs', 'Abstract', 80, 140, { fillColor: '#231515', borderColor: '#F87171', textColor: '#F87171' }),
    makeNode('res-lit', 'Literature', 230, 140, { fillColor: '#231515', borderColor: '#F87171', textColor: '#F87171' }),
    makeNode('res-meth', 'Methods', 380, 140, { fillColor: '#231515', borderColor: '#F87171', textColor: '#F87171' }),
    makeNode('res-res', 'Results', 530, 140, { fillColor: '#231515', borderColor: '#F87171', textColor: '#F87171' }),
    makeNode('res-conc', 'Conclusion', 680, 140, { fillColor: '#231515', borderColor: '#F87171', textColor: '#F87171', width: 130 }),
    makeNode('res-a1', 'Summary', 20, 230, { fillColor: '#1A1010' }),
    makeNode('res-l1', 'Source 1', 170, 230, { fillColor: '#1A1010' }),
    makeNode('res-l2', 'Source 2', 290, 230, { fillColor: '#1A1010' }),
    makeNode('res-m1', 'Approach', 380, 230, { fillColor: '#1A1010' }),
    makeNode('res-r1', 'Finding 1', 470, 230, { fillColor: '#1A1010' }),
    makeNode('res-r2', 'Finding 2', 590, 230, { fillColor: '#1A1010' }),
    makeNode('res-c1', 'Key Insight', 680, 230, { fillColor: '#1A1010' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-ra', 'res-root', 'res-abs', '#F87171'),
    makeEdge('e-rl', 'res-root', 'res-lit', '#F87171'),
    makeEdge('e-rm', 'res-root', 'res-meth', '#F87171'),
    makeEdge('e-rr', 'res-root', 'res-res', '#F87171'),
    makeEdge('e-rc', 'res-root', 'res-conc', '#F87171'),
    makeEdge('e-a1', 'res-abs', 'res-a1', '#EF4444'),
    makeEdge('e-l1', 'res-lit', 'res-l1', '#EF4444'),
    makeEdge('e-l2', 'res-lit', 'res-l2', '#EF4444'),
    makeEdge('e-m1', 'res-meth', 'res-m1', '#EF4444'),
    makeEdge('e-r1', 'res-res', 'res-r1', '#EF4444'),
    makeEdge('e-r2', 'res-res', 'res-r2', '#EF4444'),
    makeEdge('e-c1', 'res-conc', 'res-c1', '#EF4444'),
  ]
  return {
    slug: 'research-paper', title: 'Research Paper',
    description: 'Structure a thesis with arguments, evidence, and conclusions. Organize your research paper sections from abstract to conclusion.',
    category: 'research' as const, tags: ['research', 'academic', 'thesis', 'paper'],
    aiEnhanced: false, nodes, edges, nodeCount: 13, levelCount: 3,
  }
}

// ── Template 7: Pros & Cons ──
function prosCons() {
  const nodes: SeedNode[] = [
    makeNode('pc-root', 'Decision', 370, 40, { isRoot: true, fillColor: '#1F1A2E', borderColor: '#8B5CF6', textColor: '#8B5CF6' }),
    makeNode('pc-pro', 'Pros', 200, 140, { fillColor: '#0F2E1F', borderColor: '#22C55E', textColor: '#22C55E' }),
    makeNode('pc-con', 'Cons', 540, 140, { fillColor: '#2E1F1F', borderColor: '#EF4444', textColor: '#EF4444' }),
    makeNode('pc-p1', 'Pro 1', 120, 230, { fillColor: '#152318' }),
    makeNode('pc-p2', 'Pro 2', 200, 310, { fillColor: '#152318' }),
    makeNode('pc-p3', 'Pro 3', 280, 230, { fillColor: '#152318' }),
    makeNode('pc-c1', 'Con 1', 460, 230, { fillColor: '#231515' }),
    makeNode('pc-c2', 'Con 2', 540, 310, { fillColor: '#231515' }),
    makeNode('pc-c3', 'Con 3', 620, 230, { fillColor: '#231515' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-ppro', 'pc-root', 'pc-pro', '#22C55E'),
    makeEdge('e-pcon', 'pc-root', 'pc-con', '#EF4444'),
    makeEdge('e-p1', 'pc-pro', 'pc-p1', '#22C55E'),
    makeEdge('e-p2', 'pc-pro', 'pc-p2', '#22C55E'),
    makeEdge('e-p3', 'pc-pro', 'pc-p3', '#22C55E'),
    makeEdge('e-c1', 'pc-con', 'pc-c1', '#EF4444'),
    makeEdge('e-c2', 'pc-con', 'pc-c2', '#EF4444'),
    makeEdge('e-c3', 'pc-con', 'pc-c3', '#EF4444'),
  ]
  return {
    slug: 'pros-and-cons', title: 'Pros & Cons',
    description: 'Balanced decision-making with weighted arguments. Visually compare the advantages and disadvantages of any choice.',
    category: 'planning' as const, tags: ['decision', 'comparison', 'analysis', 'planning'],
    aiEnhanced: false, nodes, edges, nodeCount: 9, levelCount: 3,
  }
}

// ── Template 8: Sprint Retro ──
function sprintRetro() {
  const nodes: SeedNode[] = [
    makeNode('retro-root', 'Sprint', 370, 40, { isRoot: true, fillColor: '#2E2A1F', borderColor: '#F59E0B', textColor: '#F59E0B' }),
    makeNode('retro-well', 'Went Well', 150, 140, { fillColor: '#0F2E1F', borderColor: '#22C55E', textColor: '#22C55E', width: 130 }),
    makeNode('retro-bad', "Didn't Go Well", 370, 140, { fillColor: '#2E1F1F', borderColor: '#EF4444', textColor: '#EF4444', width: 150 }),
    makeNode('retro-action', 'Action Items', 610, 140, { fillColor: '#1A2040', borderColor: '#3B82F6', textColor: '#3B82F6', width: 130 }),
    makeNode('retro-w1', 'Win 1', 80, 230, { fillColor: '#152318' }),
    makeNode('retro-w2', 'Win 2', 220, 230, { fillColor: '#152318' }),
    makeNode('retro-b1', 'Issue 1', 300, 230, { fillColor: '#231515' }),
    makeNode('retro-b2', 'Issue 2', 440, 230, { fillColor: '#231515' }),
    makeNode('retro-a1', 'Action 1', 540, 230, { fillColor: '#111828' }),
    makeNode('retro-a2', 'Action 2', 680, 230, { fillColor: '#111828' }),
  ]
  const edges: SeedEdge[] = [
    makeEdge('e-rw', 'retro-root', 'retro-well', '#22C55E'),
    makeEdge('e-rb', 'retro-root', 'retro-bad', '#EF4444'),
    makeEdge('e-ra', 'retro-root', 'retro-action', '#3B82F6'),
    makeEdge('e-w1', 'retro-well', 'retro-w1', '#22C55E'),
    makeEdge('e-w2', 'retro-well', 'retro-w2', '#22C55E'),
    makeEdge('e-b1', 'retro-bad', 'retro-b1', '#EF4444'),
    makeEdge('e-b2', 'retro-bad', 'retro-b2', '#EF4444'),
    makeEdge('e-a1', 'retro-action', 'retro-a1', '#3B82F6'),
    makeEdge('e-a2', 'retro-action', 'retro-a2', '#3B82F6'),
  ]
  return {
    slug: 'sprint-retro', title: 'Sprint Retro',
    description: "What went well, what didn't, and action items. Structure your sprint retrospective for productive team reflection.",
    category: 'creative' as const, tags: ['agile', 'sprint', 'retrospective', 'team'],
    aiEnhanced: true, nodes, edges, nodeCount: 10, levelCount: 3,
  }
}

/**
 * Compact 3-level tree factory used for the bulk catalog templates.
 * - 1 root, N mids, M leaves per mid (auto-laid out).
 */
type TplCategory = 'education' | 'business' | 'creative' | 'planning' | 'research'

interface SimpleTreeSpec {
  slug: string
  title: string
  description: string
  category: TplCategory
  tags: string[]
  aiEnhanced?: boolean
  root: string
  mids: string[]
  leavesPerMid: string[][]
  /** mint, blue, purple, green, red, amber */
  accent: 'mint' | 'blue' | 'purple' | 'green' | 'red' | 'amber'
}

const ACCENT_PALETTE: Record<SimpleTreeSpec['accent'], { fill: string; border: string; text: string; mid: { fill: string; border: string; text: string }; leafFill: string }> = {
  mint:   { fill: '#0F3D38', border: '#00D2BE', text: '#00D2BE', mid: { fill: '#0F2D28', border: '#2DD4BF', text: '#2DD4BF' }, leafFill: '#0C201D' },
  blue:   { fill: '#1A2040', border: '#3B82F6', text: '#3B82F6', mid: { fill: '#152238', border: '#60A5FA', text: '#60A5FA' }, leafFill: '#111828' },
  purple: { fill: '#1F1A2E', border: '#8B5CF6', text: '#8B5CF6', mid: { fill: '#1A1530', border: '#A78BFA', text: '#A78BFA' }, leafFill: '#141020' },
  green:  { fill: '#0F2E1F', border: '#22C55E', text: '#22C55E', mid: { fill: '#152318', border: '#34D399', text: '#34D399' }, leafFill: '#0F1E14' },
  red:    { fill: '#2E1F1F', border: '#EF4444', text: '#EF4444', mid: { fill: '#231515', border: '#F87171', text: '#F87171' }, leafFill: '#1A1010' },
  amber:  { fill: '#2E2A1F', border: '#F59E0B', text: '#F59E0B', mid: { fill: '#201E15', border: '#FBBF24', text: '#FBBF24' }, leafFill: '#1A1810' },
}

function simpleTree(spec: SimpleTreeSpec) {
  const p = ACCENT_PALETTE[spec.accent]
  const nodes: SeedNode[] = []
  const edges: SeedEdge[] = []
  const slug = spec.slug.replace(/[^a-z0-9-]/g, '')
  const cx = 370
  const midGap = 200
  const leafGap = 140

  nodes.push(makeNode(`${slug}-root`, spec.root, cx, 40, { isRoot: true, fillColor: p.fill, borderColor: p.border, textColor: p.text }))

  const midCount = spec.mids.length
  const midStartX = cx - ((midCount - 1) * midGap) / 2

  spec.mids.forEach((midLabel, i) => {
    const midId = `${slug}-m${i}`
    const midX = midStartX + i * midGap
    nodes.push(makeNode(midId, midLabel, midX, 150, { fillColor: p.mid.fill, borderColor: p.mid.border, textColor: p.mid.text, width: 132 }))
    edges.push(makeEdge(`${slug}-e-m${i}`, `${slug}-root`, midId, p.mid.border))

    const leaves = spec.leavesPerMid[i] ?? []
    const leafCount = leaves.length
    const leafStartX = midX - ((leafCount - 1) * leafGap) / 2
    leaves.forEach((leafLabel, j) => {
      const leafId = `${slug}-m${i}-l${j}`
      const leafX = leafStartX + j * leafGap
      nodes.push(makeNode(leafId, leafLabel, leafX, 270, { fillColor: p.leafFill, width: 124 }))
      edges.push(makeEdge(`${slug}-e-m${i}-l${j}`, midId, leafId, p.mid.border))
    })
  })

  const nodeCount = nodes.length
  const levelCount = 3
  return {
    slug: spec.slug,
    title: spec.title,
    description: spec.description,
    category: spec.category,
    tags: spec.tags,
    aiEnhanced: spec.aiEnhanced ?? true,
    nodes, edges, nodeCount, levelCount,
  }
}

const CATALOG_SPECS: SimpleTreeSpec[] = [
  // ── Education (4 more) ─────────────────────────────────────────────
  { slug: 'cornell-notes', title: 'Cornell Notes', accent: 'blue',
    description: 'The classic Cornell note-taking layout — cues on the left, detailed notes on the right, summary at the bottom. Designed for retention, not just transcription.',
    category: 'education', tags: ['notes', 'study', 'cornell', 'method'], aiEnhanced: true,
    root: 'Topic', mids: ['Cues', 'Notes', 'Summary'],
    leavesPerMid: [['Question 1', 'Question 2'], ['Detail 1', 'Detail 2'], ['Key takeaway', 'Action']] },
  { slug: 'concept-map', title: 'Concept Map', accent: 'blue',
    description: 'Connect concepts with labelled relationships. Used in education research to expose understanding, not just facts.',
    category: 'education', tags: ['concepts', 'learning', 'relationships'], aiEnhanced: true,
    root: 'Concept', mids: ['Cause', 'Effect', 'Example'],
    leavesPerMid: [['Driver A', 'Driver B'], ['Outcome 1', 'Outcome 2'], ['Case 1', 'Case 2']] },
  { slug: 'lesson-plan', title: 'Lesson Plan', accent: 'blue',
    description: 'Structure a class around objectives, activities, and assessment — explicit, sequenced, and time-boxed.',
    category: 'education', tags: ['teaching', 'lesson', 'classroom'], aiEnhanced: true,
    root: 'Lesson', mids: ['Objectives', 'Activities', 'Assessment'],
    leavesPerMid: [['Skill', 'Knowledge'], ['Warm-up', 'Practice'], ['Quiz', 'Reflection']] },
  { slug: 'flashcard-set', title: 'Flashcard Set', accent: 'blue',
    description: 'Build a study set as a tree — categories at level one, term/definition pairs as leaves. Export to Anki-style review later.',
    category: 'education', tags: ['flashcards', 'memorize', 'spaced-repetition'], aiEnhanced: true,
    root: 'Subject', mids: ['Chapter 1', 'Chapter 2', 'Chapter 3'],
    leavesPerMid: [['Term A', 'Term B'], ['Term C', 'Term D'], ['Term E', 'Term F']] },

  // ── Business (3 more) ──────────────────────────────────────────────
  { slug: 'okr-tree', title: 'OKR Tree', accent: 'mint',
    description: 'One company-level objective, supporting team objectives, and measurable key results under each. Ladder up to strategy, not vanity metrics.',
    category: 'business', tags: ['okr', 'goals', 'metrics', 'strategy'], aiEnhanced: true,
    root: 'Objective', mids: ['Team A', 'Team B', 'Team C'],
    leavesPerMid: [['KR 1', 'KR 2'], ['KR 3', 'KR 4'], ['KR 5', 'KR 6']] },
  { slug: 'business-model-canvas', title: 'Business Model Canvas', accent: 'mint',
    description: 'Nine building blocks of a business — value, customers, channels, costs. The Osterwalder canvas, hierarchical for fast iteration.',
    category: 'business', tags: ['business-model', 'canvas', 'startup', 'strategy'], aiEnhanced: true,
    root: 'Business', mids: ['Value Prop', 'Customers', 'Revenue', 'Costs'],
    leavesPerMid: [['Pain solved', 'Gain made'], ['Segment A', 'Segment B'], ['Stream 1', 'Stream 2'], ['Fixed', 'Variable']] },
  { slug: 'go-to-market', title: 'Go-to-Market Plan', accent: 'mint',
    description: 'Position, target, channels, pricing — a launch plan that survives contact with a real market.',
    category: 'business', tags: ['gtm', 'launch', 'marketing', 'sales'], aiEnhanced: true,
    root: 'Launch', mids: ['Positioning', 'Channels', 'Pricing'],
    leavesPerMid: [['Audience', 'Message'], ['Inbound', 'Outbound'], ['Tier 1', 'Tier 2']] },

  // ── Creative (3 more) ──────────────────────────────────────────────
  { slug: 'story-arc', title: 'Story Arc', accent: 'amber',
    description: 'Three-act story structure with rising action, climax, and resolution. Map plot beats before you write a word of prose.',
    category: 'creative', tags: ['writing', 'story', 'plot', 'arc'], aiEnhanced: true,
    root: 'Story', mids: ['Setup', 'Confrontation', 'Resolution'],
    leavesPerMid: [['Hook', 'Inciting'], ['Rising', 'Climax'], ['Falling', 'Ending']] },
  { slug: 'character-bible', title: 'Character Bible', accent: 'amber',
    description: 'Build a character from the inside out — backstory, motivation, voice, arc. The bible you never break.',
    category: 'creative', tags: ['character', 'writing', 'fiction'], aiEnhanced: true,
    root: 'Character', mids: ['Backstory', 'Motivation', 'Arc'],
    leavesPerMid: [['Origin', 'Wound'], ['Want', 'Need'], ['Start', 'End']] },
  { slug: 'songwriting', title: 'Song Structure', accent: 'amber',
    description: 'Verse, chorus, bridge, hook — sketch a song as a tree before recording. Genre-agnostic skeleton.',
    category: 'creative', tags: ['music', 'song', 'lyrics', 'composition'], aiEnhanced: true,
    root: 'Song', mids: ['Verse', 'Chorus', 'Bridge'],
    leavesPerMid: [['Lyric A', 'Lyric B'], ['Hook', 'Refrain'], ['Twist', 'Outro']] },

  // ── Planning (3 more) ──────────────────────────────────────────────
  { slug: 'eisenhower-matrix', title: 'Eisenhower Matrix', accent: 'purple',
    description: 'Urgent vs important — sort tasks into Do, Schedule, Delegate, Drop. Cuts through the false-urgency trap.',
    category: 'planning', tags: ['priorities', 'productivity', 'matrix'], aiEnhanced: false,
    root: 'Tasks', mids: ['Do', 'Schedule', 'Delegate', 'Drop'],
    leavesPerMid: [['Task 1', 'Task 2'], ['Task 3', 'Task 4'], ['Task 5', 'Task 6'], ['Task 7', 'Task 8']] },
  { slug: 'weekly-review', title: 'Weekly Review', accent: 'purple',
    description: 'GTD-style weekly review — what shipped, what stalled, what next. Process before you plan.',
    category: 'planning', tags: ['weekly', 'review', 'gtd', 'productivity'], aiEnhanced: false,
    root: 'Week', mids: ['Wins', 'Stalled', 'Next'],
    leavesPerMid: [['Win 1', 'Win 2'], ['Block 1', 'Block 2'], ['Priority 1', 'Priority 2']] },
  { slug: 'event-planner', title: 'Event Planner', accent: 'purple',
    description: 'Logistics, content, and attendees mapped into one place. Catch the dependency you forgot in the spreadsheet.',
    category: 'planning', tags: ['event', 'logistics', 'planning'], aiEnhanced: true,
    root: 'Event', mids: ['Logistics', 'Content', 'Attendees'],
    leavesPerMid: [['Venue', 'A/V'], ['Speakers', 'Agenda'], ['Invites', 'RSVP']] },

  // ── Research (3 more) ──────────────────────────────────────────────
  { slug: 'literature-review', title: 'Literature Review', accent: 'red',
    description: 'Group sources by theme, surface gaps, and trace the conversation across papers. The map your supervisor actually wants.',
    category: 'research', tags: ['research', 'literature', 'sources'], aiEnhanced: true,
    root: 'Topic', mids: ['Theme A', 'Theme B', 'Gap'],
    leavesPerMid: [['Source 1', 'Source 2'], ['Source 3', 'Source 4'], ['Open Q1', 'Open Q2']] },
  { slug: 'user-interview', title: 'User Interview', accent: 'red',
    description: 'Plan a research interview — goals, questions, follow-ups. The script that doesn\'t feel like a script.',
    category: 'research', tags: ['user-research', 'interview', 'ux'], aiEnhanced: true,
    root: 'Interview', mids: ['Context', 'Behavior', 'Goals'],
    leavesPerMid: [['Background', 'Tools'], ['Workflow', 'Pain'], ['Outcome', 'Success']] },
  { slug: 'experiment-design', title: 'Experiment Design', accent: 'red',
    description: 'Hypothesis, variables, controls, metrics. Frame an experiment so the result actually changes a decision.',
    category: 'research', tags: ['experiment', 'science', 'hypothesis'], aiEnhanced: true,
    root: 'Hypothesis', mids: ['Variables', 'Method', 'Metrics'],
    leavesPerMid: [['Independent', 'Dependent'], ['Control', 'Treatment'], ['Primary', 'Secondary']] },
]

const usageCounts: Record<string, number> = {
  'swot-analysis': 2400,
  'brainstorm': 5100,
  'study-notes': 3800,
  'project-plan': 1900,
  'competitor-analysis': 1200,
  'research-paper': 890,
  'pros-and-cons': 3200,
  'sprint-retro': 2100,
  // Catalog (16 more — synthetic counts so the gallery feels lived-in)
  'cornell-notes': 1800,
  'concept-map': 1450,
  'lesson-plan': 1100,
  'flashcard-set': 980,
  'okr-tree': 2700,
  'business-model-canvas': 2200,
  'go-to-market': 1650,
  'story-arc': 1900,
  'character-bible': 1300,
  'songwriting': 720,
  'eisenhower-matrix': 3400,
  'weekly-review': 2050,
  'event-planner': 860,
  'literature-review': 760,
  'user-interview': 1400,
  'experiment-design': 640,
}

interface SeededTemplate {
  slug: string
  title: string
  description: string
  category: TplCategory
  tags: string[]
  aiEnhanced: boolean
  nodes: SeedNode[]
  edges: SeedEdge[]
  nodeCount: number
  levelCount: number
}

export async function seedTemplates() {
  const templateFns: Array<() => SeededTemplate> = [
    swotAnalysis,
    brainstorm,
    studyNotes,
    projectPlan,
    competitorAnalysis,
    researchPaper,
    prosCons,
    sprintRetro,
    // Catalog templates (16) generated from compact specs
    ...CATALOG_SPECS.map(spec => () => simpleTree(spec)),
  ]

  for (const fn of templateFns) {
    const t = fn()
    const existing = await prisma.template.findUnique({ where: { slug: t.slug } })
    if (existing) {
      console.log(`  ⏭ Template "${t.title}" already exists, skipping`)
      continue
    }

    const preview = generatePreview(t.nodes)

    await prisma.template.create({
      data: {
        slug: t.slug,
        title: t.title,
        description: t.description,
        category: t.category,
        tags: t.tags,
        nodes: toRecord(t.nodes),
        edges: toRecord(t.edges),
        nodeCount: t.nodeCount,
        levelCount: t.levelCount,
        previewData: preview,
        aiEnhanced: t.aiEnhanced,
        isSystem: true,
        isPublic: true,
        usageCount: usageCounts[t.slug] || 0,
        // authorId is null for system templates (no real user)
      },
    })
    console.log(`  ✓ Created template "${t.title}"`)
  }
}

// Run if executed directly
if (require.main === module) {
  seedTemplates()
    .then(() => {
      console.log('✅ Seed templates complete')
      process.exit(0)
    })
    .catch((e) => {
      console.error('❌ Seed failed:', e)
      process.exit(1)
    })
}
