// Domain keyword dictionaries and ontology guidance data

import type { DomainType, OntologyGuidance } from '../types/subject'

/** Keywords for each domain (~30-80 high-signal terms per domain) */
export const DOMAIN_KEYWORDS: Record<DomainType, string[]> = {
  'computer-science': [
    'algorithm', 'data structure', 'array', 'linked list', 'tree', 'graph', 'hash',
    'binary', 'sorting', 'searching', 'complexity', 'O(n)', 'recursion', 'stack',
    'queue', 'heap', 'database', 'SQL', 'API', 'REST', 'HTTP', 'server', 'client',
    'frontend', 'backend', 'compiler', 'interpreter', 'machine learning', 'neural network',
    'deep learning', 'AI', 'artificial intelligence', 'programming', 'code', 'software',
    'function', 'class', 'object', 'variable', 'loop', 'condition', 'boolean',
    'string', 'integer', 'float', 'memory', 'CPU', 'thread', 'process', 'cache',
    'encryption', 'cybersecurity', 'protocol', 'TCP', 'UDP', 'DNS', 'IP address',
    'cloud', 'container', 'docker', 'kubernetes', 'microservice', 'devops', 'git',
    'operating system', 'kernel', 'file system', 'network', 'bandwidth', 'latency',
    'distributed', 'parallel', 'concurrent', 'deadlock', 'mutex', 'semaphore',
    'polymorphism', 'inheritance', 'encapsulation', 'abstraction', 'interface',
    'design pattern', 'singleton', 'factory', 'observer', 'MVC'
  ],
  'mathematics': [
    'theorem', 'proof', 'lemma', 'corollary', 'axiom', 'conjecture', 'equation',
    'function', 'variable', 'constant', 'integral', 'derivative', 'calculus',
    'algebra', 'geometry', 'topology', 'number theory', 'set theory', 'group theory',
    'matrix', 'vector', 'tensor', 'eigenvalue', 'eigenvector', 'determinant',
    'probability', 'statistics', 'distribution', 'mean', 'variance', 'standard deviation',
    'hypothesis', 'regression', 'correlation', 'polynomial', 'logarithm', 'exponential',
    'trigonometry', 'sine', 'cosine', 'tangent', 'limit', 'convergence', 'series',
    'infinity', 'real number', 'complex number', 'rational', 'irrational',
    'combinatorics', 'permutation', 'combination', 'graph theory', 'optimization',
    'linear algebra', 'differential equation', 'partial derivative', 'Fourier',
    'Laplace', 'transformation', 'isomorphism', 'homomorphism'
  ],
  'physics': [
    'force', 'energy', 'mass', 'velocity', 'acceleration', 'momentum', 'gravity',
    'quantum', 'relativity', 'photon', 'electron', 'proton', 'neutron', 'atom',
    'particle', 'wave', 'frequency', 'wavelength', 'amplitude', 'electromagnetic',
    'thermodynamics', 'entropy', 'temperature', 'pressure', 'volume', 'heat',
    'Newton', 'Einstein', 'Planck', 'Schrödinger', 'Heisenberg', 'uncertainty',
    'field', 'potential', 'kinetic', 'nuclear', 'fission', 'fusion', 'radiation',
    'mechanics', 'dynamics', 'statics', 'fluid', 'optics', 'lens', 'mirror',
    'magnetic', 'electric', 'circuit', 'voltage', 'current', 'resistance',
    'spacetime', 'black hole', 'dark matter', 'dark energy', 'cosmology',
    'string theory', 'standard model', 'boson', 'fermion', 'quark', 'lepton'
  ],
  'engineering': [
    'design', 'system', 'requirement', 'specification', 'prototype', 'testing',
    'material', 'stress', 'strain', 'load', 'structural', 'mechanical', 'electrical',
    'civil', 'chemical', 'aerospace', 'manufacturing', 'production', 'quality',
    'tolerance', 'CAD', 'simulation', 'FEA', 'CFD', 'optimization', 'efficiency',
    'safety', 'reliability', 'maintenance', 'lifecycle', 'cost', 'budget',
    'circuit', 'signal', 'control', 'feedback', 'sensor', 'actuator', 'robot',
    'automation', 'PLC', 'SCADA', 'IoT', 'embedded', 'firmware', 'PCB',
    'thermodynamics', 'heat transfer', 'fluid mechanics', 'vibration'
  ],
  'biology': [
    'cell', 'DNA', 'RNA', 'protein', 'gene', 'genome', 'chromosome', 'mutation',
    'evolution', 'natural selection', 'species', 'taxonomy', 'ecology', 'ecosystem',
    'organism', 'bacteria', 'virus', 'fungi', 'plant', 'animal', 'photosynthesis',
    'respiration', 'metabolism', 'enzyme', 'substrate', 'mitosis', 'meiosis',
    'membrane', 'organelle', 'nucleus', 'ribosome', 'mitochondria', 'chloroplast',
    'biodiversity', 'habitat', 'population', 'community', 'biome', 'food chain',
    'symbiosis', 'parasitism', 'mutualism', 'predator', 'prey', 'adaptation',
    'phenotype', 'genotype', 'allele', 'dominant', 'recessive', 'heredity'
  ],
  'chemistry': [
    'element', 'compound', 'molecule', 'atom', 'ion', 'bond', 'covalent', 'ionic',
    'reaction', 'catalyst', 'equilibrium', 'acid', 'base', 'pH', 'oxidation',
    'reduction', 'redox', 'organic', 'inorganic', 'polymer', 'monomer', 'solvent',
    'solution', 'concentration', 'molar', 'molarity', 'titration', 'buffer',
    'periodic table', 'electron', 'orbital', 'valence', 'isotope', 'radioactive',
    'synthesis', 'decomposition', 'precipitation', 'crystallization', 'distillation',
    'spectroscopy', 'chromatography', 'mass spectrometry', 'NMR'
  ],
  'medicine': [
    'diagnosis', 'treatment', 'symptom', 'disease', 'disorder', 'syndrome',
    'pathology', 'etiology', 'prognosis', 'therapy', 'medication', 'drug',
    'pharmaceutical', 'dosage', 'side effect', 'clinical trial', 'placebo',
    'patient', 'doctor', 'surgeon', 'nurse', 'hospital', 'surgery', 'procedure',
    'anatomy', 'physiology', 'organ', 'tissue', 'blood', 'immune', 'antibody',
    'vaccine', 'infection', 'inflammation', 'chronic', 'acute', 'malignant',
    'benign', 'tumor', 'cancer', 'cardiovascular', 'neurological', 'respiratory',
    'epidemiology', 'prevalence', 'incidence', 'mortality', 'morbidity'
  ],
  'psychology': [
    'behavior', 'cognition', 'emotion', 'personality', 'motivation', 'perception',
    'memory', 'learning', 'attention', 'consciousness', 'unconscious', 'subconscious',
    'Freud', 'Jung', 'Piaget', 'Skinner', 'Pavlov', 'Maslow', 'cognitive bias',
    'heuristic', 'conditioning', 'reinforcement', 'punishment', 'stimulus', 'response',
    'attachment', 'development', 'nature', 'nurture', 'intelligence', 'IQ',
    'anxiety', 'depression', 'trauma', 'stress', 'coping', 'resilience',
    'therapy', 'CBT', 'psychoanalysis', 'mindfulness', 'neurotransmitter',
    'dopamine', 'serotonin', 'cortisol', 'amygdala', 'hippocampus', 'prefrontal'
  ],
  'education': [
    'curriculum', 'pedagogy', 'assessment', 'evaluation', 'learning outcome',
    'teaching', 'instruction', 'student', 'teacher', 'classroom', 'school',
    'university', 'degree', 'diploma', 'certification', 'accreditation',
    'Bloom taxonomy', 'constructivism', 'scaffolding', 'differentiation',
    'formative', 'summative', 'rubric', 'standard', 'literacy', 'numeracy',
    'STEM', 'special education', 'inclusion', 'gifted', 'remedial',
    'e-learning', 'blended learning', 'flipped classroom', 'Montessori',
    'Waldorf', 'competency', 'skill', 'knowledge', 'comprehension'
  ],
  'business': [
    'strategy', 'management', 'leadership', 'organization', 'stakeholder',
    'value proposition', 'business model', 'revenue', 'profit', 'loss', 'margin',
    'market', 'customer', 'competitor', 'supply chain', 'logistics', 'operations',
    'HR', 'human resources', 'KPI', 'OKR', 'ROI', 'SWOT', 'PESTEL',
    "Porter's Five Forces", 'competitive advantage', 'differentiation', 'cost leadership',
    'merger', 'acquisition', 'partnership', 'joint venture', 'startup', 'scale',
    'innovation', 'disruption', 'pivot', 'lean', 'agile', 'scrum',
    'board', 'CEO', 'CFO', 'COO', 'CTO', 'governance', 'compliance'
  ],
  'marketing': [
    'brand', 'branding', 'positioning', 'segmentation', 'targeting', 'persona',
    'funnel', 'conversion', 'lead', 'campaign', 'content marketing', 'SEO', 'SEM',
    'social media', 'email marketing', 'PPC', 'CTR', 'impression', 'reach',
    'engagement', 'retention', 'churn', 'lifetime value', 'CAC', 'NPS',
    'market research', 'survey', 'focus group', 'A/B testing', 'analytics',
    'copywriting', 'headline', 'CTA', 'landing page', 'buyer journey',
    'awareness', 'consideration', 'decision', 'advocacy', 'referral',
    'influencer', 'viral', 'growth hacking', 'product-market fit'
  ],
  'finance': [
    'investment', 'stock', 'bond', 'equity', 'debt', 'portfolio', 'diversification',
    'risk', 'return', 'yield', 'dividend', 'interest rate', 'compound interest',
    'inflation', 'deflation', 'GDP', 'fiscal', 'monetary', 'central bank',
    'exchange rate', 'forex', 'cryptocurrency', 'blockchain', 'DeFi',
    'balance sheet', 'income statement', 'cash flow', 'EBITDA', 'P/E ratio',
    'market cap', 'IPO', 'hedge fund', 'mutual fund', 'ETF', 'index',
    'options', 'futures', 'derivative', 'leverage', 'margin', 'short selling',
    'valuation', 'DCF', 'NPV', 'IRR', 'WACC', 'beta', 'alpha'
  ],
  'economics': [
    'supply', 'demand', 'equilibrium', 'price', 'cost', 'utility', 'marginal',
    'microeconomics', 'macroeconomics', 'GDP', 'GNP', 'inflation', 'unemployment',
    'fiscal policy', 'monetary policy', 'trade', 'tariff', 'subsidy', 'tax',
    'market failure', 'externality', 'public good', 'monopoly', 'oligopoly',
    'perfect competition', 'elasticity', 'consumer surplus', 'producer surplus',
    'Keynesian', 'classical', 'neoclassical', 'behavioral economics',
    'game theory', 'Nash equilibrium', 'comparative advantage', 'opportunity cost',
    'scarcity', 'allocation', 'incentive', 'rational', 'bounded rationality'
  ],
  'law': [
    'statute', 'regulation', 'legislation', 'constitution', 'amendment', 'bill',
    'court', 'judge', 'jury', 'plaintiff', 'defendant', 'prosecution', 'defense',
    'contract', 'tort', 'liability', 'negligence', 'damages', 'remedy',
    'criminal', 'civil', 'jurisdiction', 'precedent', 'case law', 'common law',
    'statutory', 'intellectual property', 'patent', 'copyright', 'trademark',
    'due process', 'habeas corpus', 'appeal', 'verdict', 'sentence',
    'compliance', 'regulation', 'governance', 'ethics', 'rights', 'freedom'
  ],
  'philosophy': [
    'ethics', 'morality', 'virtue', 'duty', 'consequence', 'utilitarian',
    'deontological', 'existential', 'phenomenology', 'metaphysics', 'epistemology',
    'ontology', 'logic', 'argument', 'premise', 'conclusion', 'fallacy',
    'Plato', 'Aristotle', 'Kant', 'Nietzsche', 'Heidegger', 'Wittgenstein',
    'consciousness', 'free will', 'determinism', 'relativism', 'absolutism',
    'empiricism', 'rationalism', 'pragmatism', 'stoicism', 'nihilism',
    'aesthetics', 'beauty', 'sublime', 'truth', 'justice', 'good', 'evil',
    'mind-body', 'dualism', 'materialism', 'idealism', 'dialectic'
  ],
  'literature': [
    'novel', 'poem', 'drama', 'fiction', 'non-fiction', 'narrative', 'plot',
    'character', 'protagonist', 'antagonist', 'theme', 'motif', 'symbol',
    'metaphor', 'simile', 'allegory', 'irony', 'satire', 'genre', 'style',
    'prose', 'verse', 'stanza', 'rhyme', 'meter', 'sonnet', 'haiku',
    'Shakespeare', 'Dickens', 'Austen', 'Tolstoy', 'Hemingway', 'Woolf',
    'modernism', 'postmodernism', 'romanticism', 'realism', 'naturalism',
    'tragedy', 'comedy', 'epic', 'lyric', 'fable', 'myth', 'archetype'
  ],
  'art': [
    'painting', 'sculpture', 'drawing', 'printmaking', 'photography', 'installation',
    'composition', 'color', 'form', 'line', 'texture', 'space', 'perspective',
    'abstract', 'figurative', 'impressionism', 'expressionism', 'cubism', 'surrealism',
    'renaissance', 'baroque', 'modern', 'contemporary', 'minimalism', 'pop art',
    'canvas', 'medium', 'palette', 'brush', 'technique', 'style', 'movement',
    'gallery', 'museum', 'exhibition', 'curator', 'critique', 'aesthetic'
  ],
  'music': [
    'melody', 'harmony', 'rhythm', 'tempo', 'key', 'scale', 'chord', 'note',
    'octave', 'interval', 'progression', 'cadence', 'dynamics', 'timbre',
    'symphony', 'concerto', 'sonata', 'opera', 'jazz', 'blues', 'rock',
    'classical', 'baroque', 'romantic', 'modern', 'electronic', 'hip-hop',
    'composer', 'conductor', 'performer', 'instrument', 'orchestra', 'ensemble',
    'notation', 'score', 'arrangement', 'improvisation', 'counterpoint', 'fugue'
  ],
  'history': [
    'civilization', 'empire', 'dynasty', 'revolution', 'war', 'treaty', 'alliance',
    'colony', 'independence', 'democracy', 'monarchy', 'republic', 'feudalism',
    'ancient', 'medieval', 'modern', 'contemporary', 'renaissance', 'enlightenment',
    'industrial revolution', 'world war', 'cold war', 'colonialism', 'imperialism',
    'archaeology', 'artifact', 'primary source', 'secondary source', 'historiography',
    'chronology', 'era', 'epoch', 'century', 'decade', 'migration', 'trade route'
  ],
  'writing': [
    'draft', 'revision', 'editing', 'proofreading', 'publishing', 'manuscript',
    'paragraph', 'sentence', 'thesis', 'argument', 'evidence', 'citation',
    'narrative', 'expository', 'persuasive', 'descriptive', 'technical writing',
    'tone', 'voice', 'audience', 'purpose', 'structure', 'outline',
    'introduction', 'conclusion', 'transition', 'coherence', 'clarity',
    'grammar', 'syntax', 'punctuation', 'vocabulary', 'diction', 'rhetoric'
  ],
  'general': []
}

/** Frameworks that strongly indicate a domain */
export const FRAMEWORK_PATTERNS: Array<{ pattern: string; domain: DomainType }> = [
  { pattern: "porter's five forces", domain: 'business' },
  { pattern: 'swot analysis', domain: 'business' },
  { pattern: 'pestel', domain: 'business' },
  { pattern: 'business model canvas', domain: 'business' },
  { pattern: 'balanced scorecard', domain: 'business' },
  { pattern: 'value chain', domain: 'business' },
  { pattern: 'lean canvas', domain: 'business' },
  { pattern: 'marketing mix', domain: 'marketing' },
  { pattern: '4ps', domain: 'marketing' },
  { pattern: 'buyer persona', domain: 'marketing' },
  { pattern: 'aida model', domain: 'marketing' },
  { pattern: 'customer journey', domain: 'marketing' },
  { pattern: "bloom's taxonomy", domain: 'education' },
  { pattern: 'constructivism', domain: 'education' },
  { pattern: 'zone of proximal development', domain: 'education' },
  { pattern: "maslow's hierarchy", domain: 'psychology' },
  { pattern: 'cognitive behavioral', domain: 'psychology' },
  { pattern: 'piaget stages', domain: 'psychology' },
  { pattern: 'erikson stages', domain: 'psychology' },
  { pattern: 'big five personality', domain: 'psychology' },
  { pattern: 'scientific method', domain: 'physics' },
  { pattern: 'periodic table', domain: 'chemistry' },
  { pattern: 'central dogma', domain: 'biology' },
  { pattern: 'krebs cycle', domain: 'biology' },
  { pattern: 'design thinking', domain: 'engineering' },
  { pattern: 'agile methodology', domain: 'computer-science' },
  { pattern: 'object-oriented', domain: 'computer-science' },
  { pattern: 'functional programming', domain: 'computer-science' },
  { pattern: 'machine learning pipeline', domain: 'computer-science' },
  { pattern: 'supply and demand', domain: 'economics' },
  { pattern: 'nash equilibrium', domain: 'economics' },
  { pattern: 'game theory', domain: 'economics' },
  { pattern: 'categorical imperative', domain: 'philosophy' },
  { pattern: 'social contract', domain: 'philosophy' },
  { pattern: 'trolley problem', domain: 'philosophy' },
  { pattern: 'dcf analysis', domain: 'finance' },
  { pattern: 'capm model', domain: 'finance' },
  { pattern: 'black-scholes', domain: 'finance' },
]

/** Domain-specific ontology guidance */
export const DOMAIN_GUIDANCE: Record<DomainType, OntologyGuidance> = {
  'computer-science': {
    preferredRelationships: ['implements', 'extends', 'depends-on', 'is-a', 'has-a', 'enables', 'alternative-to'],
    preferredCategories: ['concept', 'definition', 'process', 'example'],
    vocabularyHints: ['Use precise technical terminology', 'Reference time/space complexity where relevant', 'Distinguish between interface and implementation'],
    structuralGuidance: 'Use hierarchical decomposition for concepts. Show implementation relationships. Include concrete code examples.',
    antiPatterns: ['Avoid mixing abstraction levels', 'Do not conflate language-specific with general CS concepts']
  },
  'mathematics': {
    preferredRelationships: ['is-a', 'extends', 'prerequisite-for', 'evidence-for', 'depends-on'],
    preferredCategories: ['definition', 'concept', 'example', 'process'],
    vocabularyHints: ['Use formal mathematical notation references', 'Distinguish axiom from theorem from lemma', 'Note proof techniques'],
    structuralGuidance: 'Build from axioms through definitions to theorems. Show prerequisite chains. Include intuitive examples alongside formal definitions.',
    antiPatterns: ['Avoid circular definitions', 'Do not skip prerequisite concepts']
  },
  'physics': {
    preferredRelationships: ['causes', 'depends-on', 'extends', 'evidence-for', 'prerequisite-for'],
    preferredCategories: ['concept', 'fact', 'example', 'process', 'question'],
    vocabularyHints: ['Reference SI units', 'Distinguish classical from quantum', 'Note experimental vs theoretical'],
    structuralGuidance: 'Show causal chains and force diagrams conceptually. Connect theory to experiment. Include real-world applications.',
    antiPatterns: ['Avoid conflating classical and quantum descriptions', 'Do not present hypotheses as established facts']
  },
  'engineering': {
    preferredRelationships: ['depends-on', 'enables', 'trade-off', 'implements', 'alternative-to'],
    preferredCategories: ['process', 'concept', 'example', 'fact'],
    vocabularyHints: ['Reference standards (ISO, IEEE)', 'Note safety factors', 'Include material properties'],
    structuralGuidance: 'Show design trade-offs. Connect requirements to implementations. Include failure modes and safety considerations.',
    antiPatterns: ['Avoid ignoring constraints', 'Do not present single solutions without alternatives']
  },
  'biology': {
    preferredRelationships: ['is-a', 'part-of', 'causes', 'enables', 'co-occurs'],
    preferredCategories: ['concept', 'fact', 'process', 'example'],
    vocabularyHints: ['Use binomial nomenclature where appropriate', 'Note scale (molecular/cellular/organism/ecosystem)', 'Reference model organisms'],
    structuralGuidance: 'Show taxonomic hierarchies and metabolic pathways. Connect structure to function. Include evolutionary context.',
    antiPatterns: ['Avoid teleological language', 'Do not mix correlation with causation']
  },
  'chemistry': {
    preferredRelationships: ['causes', 'enables', 'is-a', 'part-of', 'co-occurs'],
    preferredCategories: ['concept', 'fact', 'process', 'definition'],
    vocabularyHints: ['Reference periodic table groups', 'Note reaction conditions', 'Include molecular formulas'],
    structuralGuidance: 'Show reaction mechanisms step by step. Connect structure to properties. Include safety data.',
    antiPatterns: ['Avoid mixing organic and inorganic without noting the distinction']
  },
  'medicine': {
    preferredRelationships: ['causes', 'enables', 'evidence-for', 'evidence-against', 'co-occurs'],
    preferredCategories: ['concept', 'fact', 'process', 'question'],
    vocabularyHints: ['Use ICD/medical terminology', 'Note evidence levels', 'Reference clinical guidelines'],
    structuralGuidance: 'Show differential diagnoses. Connect symptoms to mechanisms. Include treatment algorithms and evidence quality.',
    antiPatterns: ['Avoid presenting single treatment without alternatives', 'Do not omit contraindications']
  },
  'psychology': {
    preferredRelationships: ['causes', 'influences', 'evidence-for', 'evidence-against', 'co-occurs'],
    preferredCategories: ['concept', 'fact', 'question', 'example'],
    vocabularyHints: ['Note sample sizes and effect sizes', 'Distinguish correlation from causation', 'Reference replication status'],
    structuralGuidance: 'Show multiple theoretical perspectives. Connect theories to experimental evidence. Note boundary conditions and limitations.',
    antiPatterns: ['Avoid treating correlations as causal', 'Do not present a single school of thought as definitive']
  },
  'education': {
    preferredRelationships: ['enables', 'prerequisite-for', 'implements', 'alternative-to', 'evidence-for'],
    preferredCategories: ['concept', 'process', 'example', 'question'],
    vocabularyHints: ['Reference learning objectives', 'Note assessment types', 'Include pedagogical frameworks'],
    structuralGuidance: 'Show learning progressions. Connect theory to classroom practice. Include differentiation strategies.',
    antiPatterns: ['Avoid one-size-fits-all approaches', 'Do not ignore learner diversity']
  },
  'business': {
    preferredRelationships: ['enables', 'depends-on', 'trade-off', 'influences', 'alternative-to'],
    preferredCategories: ['concept', 'process', 'example', 'question'],
    vocabularyHints: ['Reference industry frameworks', 'Include KPIs and metrics', 'Note market context'],
    structuralGuidance: 'Show stakeholder relationships. Connect strategy to execution. Include competitive analysis and risk assessment.',
    antiPatterns: ['Avoid ignoring stakeholder perspectives', 'Do not present strategy without implementation considerations']
  },
  'marketing': {
    preferredRelationships: ['enables', 'influences', 'leads-to', 'trade-off', 'alternative-to'],
    preferredCategories: ['concept', 'process', 'example', 'fact'],
    vocabularyHints: ['Reference customer segments', 'Include metrics (CAC, LTV, NPS)', 'Note channel specifics'],
    structuralGuidance: 'Show customer journeys. Connect tactics to strategy. Include measurement frameworks.',
    antiPatterns: ['Avoid tactics without strategy', 'Do not ignore target audience specifics']
  },
  'finance': {
    preferredRelationships: ['depends-on', 'trade-off', 'causes', 'influences', 'alternative-to'],
    preferredCategories: ['concept', 'definition', 'fact', 'process'],
    vocabularyHints: ['Reference financial formulas', 'Note risk/return trade-offs', 'Include regulatory context'],
    structuralGuidance: 'Show risk/return relationships. Connect instruments to markets. Include regulatory and tax considerations.',
    antiPatterns: ['Avoid ignoring risk', 'Do not present returns without associated risks']
  },
  'economics': {
    preferredRelationships: ['causes', 'influences', 'trade-off', 'depends-on', 'evidence-for'],
    preferredCategories: ['concept', 'definition', 'example', 'question'],
    vocabularyHints: ['Reference economic models', 'Note assumptions', 'Include empirical evidence'],
    structuralGuidance: 'Show supply/demand dynamics. Connect micro to macro. Include multiple schools of economic thought.',
    antiPatterns: ['Avoid treating models as reality', 'Do not ignore assumptions behind models']
  },
  'law': {
    preferredRelationships: ['depends-on', 'extends', 'opposes', 'prerequisite-for', 'evidence-for'],
    preferredCategories: ['definition', 'concept', 'example', 'process'],
    vocabularyHints: ['Reference specific statutes/cases', 'Note jurisdiction', 'Use precise legal terminology'],
    structuralGuidance: 'Show legal hierarchies (constitution > statute > regulation). Connect cases to principles. Include jurisdictional variations.',
    antiPatterns: ['Avoid generalizing across jurisdictions', 'Do not present legal opinions as facts']
  },
  'philosophy': {
    preferredRelationships: ['opposes', 'extends', 'evidence-for', 'evidence-against', 'alternative-to'],
    preferredCategories: ['concept', 'question', 'definition', 'example'],
    vocabularyHints: ['Reference philosophical traditions', 'Note thought experiments', 'Include counter-arguments'],
    structuralGuidance: 'Show dialectical relationships (thesis-antithesis-synthesis). Present multiple perspectives. Include thought experiments.',
    antiPatterns: ['Avoid presenting one school as definitive', 'Do not ignore counter-arguments']
  },
  'literature': {
    preferredRelationships: ['influences', 'extends', 'opposes', 'is-a', 'example-of'],
    preferredCategories: ['concept', 'example', 'question', 'fact'],
    vocabularyHints: ['Reference literary movements', 'Note narrative techniques', 'Include historical context'],
    structuralGuidance: 'Show literary movements and influences. Connect works to their context. Include close reading examples.',
    antiPatterns: ['Avoid ahistorical readings', 'Do not ignore cultural context']
  },
  'art': {
    preferredRelationships: ['influences', 'extends', 'opposes', 'example-of', 'co-occurs'],
    preferredCategories: ['concept', 'example', 'question', 'fact'],
    vocabularyHints: ['Reference art movements', 'Note techniques and media', 'Include visual analysis vocabulary'],
    structuralGuidance: 'Show movement progressions. Connect artists to their influences. Include formal analysis alongside interpretation.',
    antiPatterns: ['Avoid purely biographical approaches', 'Do not ignore formal elements']
  },
  'music': {
    preferredRelationships: ['influences', 'extends', 'part-of', 'example-of', 'co-occurs'],
    preferredCategories: ['concept', 'definition', 'example', 'process'],
    vocabularyHints: ['Reference music theory terms', 'Note genres and periods', 'Include listening examples'],
    structuralGuidance: 'Show genre evolution. Connect theory to practice. Include both Western and non-Western traditions.',
    antiPatterns: ['Avoid Euro-centric bias', 'Do not ignore cultural context of music']
  },
  'history': {
    preferredRelationships: ['causes', 'leads-to', 'precedes', 'follows', 'influences'],
    preferredCategories: ['fact', 'concept', 'question', 'example'],
    vocabularyHints: ['Reference primary sources', 'Note historiographical debates', 'Include multiple perspectives'],
    structuralGuidance: 'Show causal chains and temporal sequences. Connect events to their causes and consequences. Include multiple perspectives.',
    antiPatterns: ['Avoid presentism', 'Do not present single narratives without alternatives']
  },
  'writing': {
    preferredRelationships: ['enables', 'part-of', 'leads-to', 'alternative-to', 'example-of'],
    preferredCategories: ['process', 'concept', 'example', 'definition'],
    vocabularyHints: ['Reference writing techniques', 'Note audience considerations', 'Include revision strategies'],
    structuralGuidance: 'Show writing process stages. Connect techniques to purposes. Include before/after examples.',
    antiPatterns: ['Avoid prescriptive rules without context', 'Do not ignore genre conventions']
  },
  'general': {
    preferredRelationships: ['related-to', 'is-a', 'has-a', 'causes', 'enables'],
    preferredCategories: ['concept', 'fact', 'question', 'example', 'definition', 'process'],
    vocabularyHints: ['Use clear, accessible language', 'Define technical terms when used'],
    structuralGuidance: 'Create balanced hierarchies with varied depth. Mix conceptual and practical nodes.',
    antiPatterns: ['Avoid jargon without explanation']
  }
}
