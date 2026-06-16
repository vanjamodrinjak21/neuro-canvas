/**
 * Single source of truth for the on-device semantic embedding model.
 *
 * The AI worker loads `SEMANTIC_EMBEDDING_MODEL_ID` via transformers.js, and
 * the Semantic Field status panel displays `SEMANTIC_EMBEDDING_MODEL_NAME`.
 * Keep both in step so the status panel never advertises a model the engine
 * isn't actually running.
 */

/** Hugging Face repo id passed to the `feature-extraction` pipeline. */
export const SEMANTIC_EMBEDDING_MODEL_ID = 'nomic-ai/nomic-embed-text-v1.5'

/** Human-facing short name shown in the AI status row. */
export const SEMANTIC_EMBEDDING_MODEL_NAME = 'nomic-embed-text-v1.5'
