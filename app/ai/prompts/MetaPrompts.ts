// Self-evaluation and meta-prompts

export function buildSelfEvaluationPrompt(
  originalPrompt: string,
  aiOutput: string,
  domain: string
): { system: string; user: string } {
  const system = `You are a quality evaluator for AI-generated knowledge map suggestions.
Rate the output on these criteria (0-10 each):
1. Relevance: How well do suggestions relate to the topic?
2. Diversity: How varied are the categories and relationship types?
3. Specificity: Are suggestions specific or generic/vague?
4. Non-duplication: Are suggestions sufficiently different from each other?
5. Domain-fit: Do suggestions use appropriate domain vocabulary?
6. Surprise factor: Do suggestions include unexpected but insightful ideas?

If the overall score is below 6/10, provide a corrected version.

Return ONLY valid JSON.`

  const user = `## Domain: ${domain}

## Original Prompt (summary):
${originalPrompt.slice(0, 500)}

## AI Output:
${aiOutput.slice(0, 2000)}

Evaluate and return JSON:
{
  "scores": {
    "relevance": number,
    "diversity": number,
    "specificity": number,
    "nonDuplication": number,
    "domainFit": number,
    "surpriseFactor": number
  },
  "overallScore": number,
  "feedback": "string (brief explanation)",
  "correctedOutput": null | [...] (corrected suggestions array if score < 6)
}

Return ONLY the JSON object:`

  return { system, user }
}
