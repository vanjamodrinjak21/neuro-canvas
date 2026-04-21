import{a as N,u as q}from"./gb6jcAbd.js";function A(e){switch(e){case"concise":return"Keep descriptions brief and to the point. Focus on key facts.";case"detailed":return"Provide thorough explanations with context and nuance.";case"academic":return"Use formal academic language with precise terminology. Include scholarly context.";default:return""}}function Y(e){return e.existingNodes.length===0?"No existing nodes.":e.existingNodes.slice(0,10).map(n=>{const s=n.description?.summary?`: ${n.description.summary}`:"";return`- ${n.content}${s}`}).join(`
`)}function B(){return`{
  "title": "string (2-8 words, clear and specific)",
  "description": {
    "summary": "string (1-2 sentences explaining why this matters)",
    "keywords": ["string"] (3-5 relevant keywords)
  },
  "category": "concept" | "fact" | "question" | "example" | "definition" | "process",
  "relationshipToParent": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
  "confidence": number (0-1)
}`}function H(e,n,s=5){const m=A(n.style),r=n.domain?`
Domain/Subject Area: ${n.domain}`:"",h=`You are an expert mind mapping assistant who generates DIVERSE, INTERESTING concept suggestions. Don't just list obvious subcategories - provide a MIX of:
- Deeper explorations (what lies beneath this concept?)
- Practical applications (how is this used in real life?)
- Thought-provoking questions (what's controversial or unknown?)
- Concrete examples (specific instances, not abstract)
- Surprising connections (what unexpected things relate?)

${m}

CRITICAL REQUIREMENTS:
1. Generate exactly ${s} suggestions with VARIED categories
2. Include at least 1 question and 1 example in your suggestions
3. Titles should be 2-8 words, SPECIFIC not generic
4. Descriptions must explain WHY it matters and HOW it connects
5. Use diverse relationship types (not all "related-to")
6. Avoid generic/obvious suggestions - surprise the user!
7. Don't repeat concepts from existing nodes
8. Return ONLY valid JSON array`,u=`## Current Node: "${e}"
${n.mapTitle?`## Map Title: "${n.mapTitle}"`:""}${r}

## Existing Nodes (avoid duplicating these):
${Y(n)}

Generate ${s} DIVERSE suggestions. Include:
- At least 1 thought-provoking question about "${e}"
- At least 1 specific real-world example
- Mix of categories: concept, fact, question, example, definition, process

Return a JSON array where each object matches this schema:
${B()}

Return ONLY the JSON array:`;return{system:h,user:u}}function Q(e,n,s="detailed"){const r=`You are an expert knowledge synthesizer. Generate clear, informative descriptions for mind map nodes.

${A(s)}

IMPORTANT RULES:
1. The summary should explain WHY this concept matters, not just define it
2. Keywords should be useful for searching and categorization
3. Consider the surrounding context when crafting the description
4. Return ONLY valid JSON, no additional text`,h=n.slice(0,5).map(i=>`- ${i.content}${i.description?.summary?`: ${i.description.summary}`:""}`).join(`
`),u=`## Node to Describe: "${e}"

## Surrounding Nodes:
${h||"No surrounding nodes."}

Generate a description for this node. Return JSON matching this schema:
{
  "summary": "string (1-2 sentences explaining the significance)",
  "details": "string (optional, 2-3 sentences with additional context)",
  "keywords": ["string"] (4-6 relevant keywords for search)
}

Return ONLY the JSON object:`;return{system:r,user:u}}function X(e,n={}){const{branchCount:s=5,maxDepth:m=2,style:r="detailed",includeCrossConnections:h=!0,domain:u}=n,i=A(r),C=u?`
Domain/Subject Area: ${u}`:"",t=m>=2?2:1,o=m>=3?4:3,g=h?Math.min(s,5):0,a=`You are an expert mind mapping architect who creates rich, interconnected knowledge maps. Your maps should be visually interesting with varied structure - NOT a boring flat hierarchy.

${i}

CRITICAL STRUCTURE REQUIREMENTS:
1. Create ${s} main branches with VARIED depths (some shallow, some deep)
2. Each branch should have ${t}-${o} children, and grandchildren where appropriate
3. VARY the number of children per branch - don't make them all identical!
4. Use ALL category types across the map (concept, fact, question, example, definition, process)
5. Include thought-provoking questions and concrete examples, not just abstract concepts
${h?`6. Include ${g}+ meaningful cross-connections between different branches`:""}

STRUCTURE VARIETY GUIDELINES:
- Some branches should be deep (3+ levels) exploring details
- Some branches should be wide (4+ children) covering breadth
- Include at least 2 "question" nodes to spark curiosity
- Include at least 2 "example" nodes with real-world instances
- Make connections between seemingly unrelated branches
- Total nodes should be ${s*4}-${s*6} for an interesting map

AVOID:
- Uniform flat structures (1 root + N identical branches)
- All nodes being the same category
- Generic/vague descriptions
- Missing cross-connections between related concepts

Return ONLY valid JSON, no additional text.`,f=`## Topic: "${e}"${C}

Create a RICH, INTERESTING mind map with varied structure. Remember:
- Vary branch depths (some 1 level, some 2-3 levels deep)
- Mix categories (concepts, facts, questions, examples, definitions, processes)
- Include surprising connections between branches
- Make it visually interesting, not a flat boring tree!

Return JSON matching this schema:
{
  "rootTopic": "${e}",
  "rootDescription": {
    "summary": "string (compelling 1-2 sentence overview)",
    "keywords": ["string"] (5-7 key terms)
  },
  "branches": [
    {
      "title": "string (2-8 words, specific not generic)",
      "description": {
        "summary": "string (insightful 1-2 sentences)",
        "keywords": ["string"]
      },
      "category": "concept" | "fact" | "question" | "example" | "definition" | "process",
      "depth": 0,
      "children": [
        {
          "title": "...",
          "description": {...},
          "category": "...",
          "depth": 1,
          "children": [
            // Go deeper for some branches!
          ]
        }
      ]
    }
  ]${h?`,
  "crossConnections": [
    {
      "sourceRef": "string (title of source node - can be any node, not just main branches)",
      "targetRef": "string (title of target node)",
      "relationshipType": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
      "reason": "string (why this connection matters)"
    }
  ]`:""}
}

Return ONLY the JSON object:`;return{system:a,user:f}}function K(e,n,s={}){const{depth:m=2,maxPerLevel:r=3,style:h="detailed"}=s,u=A(h),i=n.domain?`
Domain/Subject Area: ${n.domain}`:"",C=`You are an expert mind mapping assistant creating RICH hierarchical expansions. Your output should create a mini-knowledge tree that explores "${e}" from multiple angles.

${u}

STRUCTURE REQUIREMENTS:
1. Generate ${r} DIVERSE main branches (not just categories!)
2. Each branch gets ${r-1}-${r} children exploring it deeper
3. Depth: ${m} levels - use ALL levels, don't stop at 1
4. VARY the structure - some branches deeper, some wider

CONTENT REQUIREMENTS:
1. Mix categories across the tree (questions, examples, processes, etc.)
2. Include at least 1 "Why does this matter?" type question
3. Include at least 1 real-world example or case study
4. Use varied relationship types (causes, enables, opposes, etc.)
5. Make children GENUINELY explore their parent, not just restate it

AVOID:
- Generic labels like "Types of X", "Benefits of X"
- All nodes being the same category
- Flat structures (every branch same depth)
- Missing suggestedChildren on intermediate nodes

Return ONLY valid JSON array.`,t=`## Node to Deep-Expand: "${e}"
${n.mapTitle?`## Map Title: "${n.mapTitle}"`:""}${i}

## Existing Nodes (don't duplicate):
${Y(n)}

Create a ${m}-level deep expansion tree. Each main branch should have its own children!

Return a JSON array where each object matches this schema:
{
  "title": "string (2-8 words, specific)",
  "description": {
    "summary": "string (insightful 1-2 sentences)",
    "keywords": ["string"]
  },
  "category": "concept" | "fact" | "question" | "example" | "definition" | "process",
  "relationshipToParent": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
  "confidence": number (0-1),
  "suggestedChildren": [
    // REQUIRED for depth > 1! Same structure, recursively
  ]
}

Return ONLY the JSON array:`;return{system:C,user:t}}function _(e,n,s=5){const m=`You are an expert at discovering meaningful relationships between concepts. Analyze nodes and suggest connections that reveal hidden relationships and create a more interconnected knowledge graph.

IMPORTANT RULES:
1. Only suggest connections that add genuine insight
2. Don't suggest connections that already exist
3. Choose the most accurate relationship type
4. Explain WHY the connection is meaningful
5. Assign confidence based on how certain the relationship is
6. Return ONLY valid JSON array, no additional text`,r=e.map(i=>`- ID: "${i.id}" | Content: "${i.content}"${i.description?.summary?` | Summary: ${i.description.summary}`:""}`).join(`
`),h=n.length>0?n.map(i=>`- ${i.sourceId} → ${i.targetId}`).join(`
`):"None",u=`## Nodes to Analyze:
${r}

## Existing Connections (DO NOT suggest these):
${h}

Suggest up to ${s} meaningful new connections. Return a JSON array where each object matches this schema:
{
  "sourceId": "string (ID of source node)",
  "targetId": "string (ID of target node)",
  "relationshipType": "is-a" | "has-a" | "related-to" | "causes" | "enables" | "opposes" | "example-of" | "part-of" | "leads-to",
  "reason": "string (explanation of why this connection matters)",
  "confidence": number (0-1)
}

Return ONLY the JSON array:`;return{system:m,user:u}}function Z(e){return["is-a","has-a","related-to","causes","enables","opposes","example-of","part-of","leads-to","extends","implements","prerequisite-for","alternative-to","evidence-for","evidence-against","depends-on","influences","precedes","follows","co-occurs","trade-off","stronger-than","complements"].includes(e)?e:"related-to"}function ee(e){return["concept","fact","question","example","definition","process"].includes(e)?e:"concept"}function D(e){return{"is-a":"Is A","has-a":"Has","related-to":"Related To",causes:"Causes",enables:"Enables",opposes:"Opposes","example-of":"Example Of","part-of":"Part Of","leads-to":"Leads To",extends:"Extends",implements:"Implements","prerequisite-for":"Prerequisite For","alternative-to":"Alternative To","evidence-for":"Evidence For","evidence-against":"Evidence Against","depends-on":"Depends On",influences:"Influences",precedes:"Precedes",follows:"Follows","co-occurs":"Co-occurs","trade-off":"Trade-off","stronger-than":"Stronger Than",complements:"Complements"}[e]||e}function M(e){return{"is-a":"#60A5FA","has-a":"#A78BFA","related-to":"#888890",causes:"#F472B6",enables:"#4ADE80",opposes:"#EF4444","example-of":"#FB923C","part-of":"#00D2BE","leads-to":"#FACC15",extends:"#818CF8",implements:"#34D399","prerequisite-for":"#F59E0B","alternative-to":"#EC4899","evidence-for":"#10B981","evidence-against":"#F43F5E","depends-on":"#8B5CF6",influences:"#06B6D4",precedes:"#D97706",follows:"#F97316","co-occurs":"#14B8A6","trade-off":"#E11D48","stronger-than":"#7C3AED",complements:"#059669"}[e]||"#888890"}function J(e,n){if(e.length===0)return n.length;if(n.length===0)return e.length;e.length>n.length&&([e,n]=[n,e]);const s=e.length,m=n.length;let r=Array.from({length:s+1},(u,i)=>i),h=new Array(s+1).fill(0);for(let u=1;u<=m;u++){h[0]=u;for(let i=1;i<=s;i++){const C=e.charCodeAt(i-1)===n.charCodeAt(u-1)?0:1;h[i]=Math.min(r[i]+1,h[i-1]+1,r[i-1]+C)}[r,h]=[h,r]}return r[s]}function z(e,n){const s=e.trim().toLowerCase(),m=n.trim().toLowerCase();if(s===m)return 1;const r=Math.max(s.length,m.length);return r===0?1:1-J(s,m)/r}const G={startPosition:{x:0,y:0},horizontalSpacing:220,verticalSpacing:120,radialSpread:Math.PI*2,minRadius:280};function U(e){let n=1;if(e.children)for(const s of e.children)n+=U(s);return n}function te(){const e=q();function n(t){return e.addNode({position:t.position,content:t.content,style:t.style,metadata:t.metadata,parentId:t.parentId})}function s(t,o,g){const a=e.addEdge(t,o,g?.style);return g?.label&&e.updateEdge(a.id,{label:g.label}),a}function m(t,o={x:0,y:0},g={}){const a={...G,...g},p=[],f=[],c=n({position:o,content:t.rootTopic,style:{borderColor:"#00D2BE"},metadata:{description:t.rootDescription,isRoot:!0,category:"root"}});e.updateNode(c.id,{isRoot:!0}),p.push(c.id),t.branches.length;const y=t.branches.map(l=>U(l)),d=y.reduce((l,b)=>l+b,0);let w=-Math.PI/2-a.radialSpread/2*.8;if(t.branches.forEach((l,b)=>{const x=(y[b]??1)/d*a.radialSpread*.85,I=w+x/2;w+=x+.1;const T=l.children&&l.children.length>2?1.15:1,v=a.minRadius*T,S={x:o.x+Math.cos(I)*v,y:o.y+Math.sin(I)*v},E=h(l,S,c.id,I,a,1);p.push(...E.nodeIds),f.push(...E.edgeIds)}),t.crossConnections)for(const l of t.crossConnections){const b=r(l.sourceRef,p),R=r(l.targetRef,p);if(b&&R&&b.id!==R.id){const x=s(b.id,R.id,{label:l.reason||D(l.relationshipType),style:{strokeColor:M(l.relationshipType),dashArray:[5,5]}});f.push(x.id)}}return e.resolveOverlaps(p),{rootNodeId:c.id,nodeIds:p,edgeIds:f}}function r(t,o){const g=t.trim().toLowerCase();for(const f of o){const c=e.nodes.get(f);if(c&&c.content.trim().toLowerCase()===g)return c}let a,p=0;for(const f of o){const c=e.nodes.get(f);if(!c)continue;const y=z(t,c.content);y>p&&y>=.8&&(p=y,a=c)}return a||console.warn(`[useMapRenderer] Unresolved cross-connection: "${t}" — no node matched above 80% threshold`),a}function h(t,o,g,a,p,f){const c=[],y=[],d=n({position:o,content:t.title,style:{borderColor:N(t.category)},metadata:{description:t.description,category:t.category},parentId:g});c.push(d.id);const w=e.addEdge(g,d.id);if(y.push(w.id),e.updateEdge(w.id,{ai:{relationshipType:"parent-child",confidence:1,generatedBy:"generate"}}),t.children&&t.children.length>0){const l=t.children.length,b=p.minRadius*(.55/Math.sqrt(f)),R=l>3?b*1.2:b,x=Math.PI*.7,I=Math.min(x*(1+l*.1),Math.PI*1.2),T=t.children.map(E=>E.children&&E.children.length>0?1.5+E.children.length*.3:1),v=T.reduce((E,$)=>E+$,0);let S=a-I/2;t.children.forEach((E,$)=>{const P=(T[$]??1)/v*I,O=S+P/2;S+=P;const F=1+($%2===0?.08:-.05),L=R*F,j={x:o.x+Math.cos(O)*L,y:o.y+Math.sin(O)*L},k=h(E,j,d.id,O,p,f+1);c.push(...k.nodeIds),y.push(...k.edgeIds)})}return{nodeIds:c,edgeIds:y}}function u(t,o,g={}){const{layout:a="horizontal",spacing:p=80,includeChildren:f=!0}=g,c=[],y=[];return t.forEach((d,w)=>{let l;switch(a){case"radial":{const x=w/t.length*Math.PI*2-Math.PI/2,I=200;l={x:o.position.x+Math.cos(x)*I,y:o.position.y+Math.sin(x)*I};break}case"vertical":l={x:o.position.x+o.size.width+100,y:o.position.y+w*p};break;default:l={x:o.position.x+o.size.width+100+w%3*180,y:o.position.y+Math.floor(w/3)*p}}const b=n({position:l,content:d.title,style:{borderColor:N(d.category)},metadata:{description:d.description,category:d.category,relationshipToParent:d.relationshipToParent,confidence:d.confidence},parentId:o.id});c.push(b.id);const R=s(o.id,b.id,{label:d.relationshipToParent?D(d.relationshipToParent):void 0,style:d.relationshipToParent?{strokeColor:M(d.relationshipToParent)}:void 0});if(y.push(R.id),e.updateEdge(R.id,{ai:{relationshipType:d.relationshipToParent||"related-to",confidence:d.confidence,generatedBy:"expand"}}),f&&d.suggestedChildren&&d.suggestedChildren.length>0){const x=e.nodes.get(b.id);if(x){const I=u(d.suggestedChildren,x,{layout:"vertical",spacing:p*.8,includeChildren:f});c.push(...I.nodeIds),y.push(...I.edgeIds)}}}),e.resolveOverlaps(c),{nodeIds:c,edgeIds:y}}function i(t,o,g){const a=g||{x:o.position.x+o.size.width+100,y:o.position.y},p=n({position:a,content:t.title,style:{borderColor:N(t.category)},metadata:{description:t.description,category:t.category,relationshipToParent:t.relationshipToParent,confidence:t.confidence},parentId:o.id}),f=s(o.id,p.id,{label:t.relationshipToParent?D(t.relationshipToParent):void 0,style:t.relationshipToParent?{strokeColor:M(t.relationshipToParent)}:void 0});return e.updateEdge(f.id,{ai:{relationshipType:t.relationshipToParent||"related-to",confidence:t.confidence,generatedBy:"expand"}}),{nodeId:p.id,edgeId:f.id}}function C(t,o){const g=t.position.x+t.size.width+100,a=o*80;return{x:g,y:t.position.y+a-o*40}}return{renderMapStructure:m,renderRichSuggestions:u,addRichSuggestion:i,calculateSuggestionPosition:C,getCategoryColor:N}}export{ee as a,_ as b,K as c,X as d,Q as e,H as f,Z as p,te as u};
