import * as Y from 'yjs'
import { prisma } from './prisma'
import { verifyFlushSignature } from './collabAuth'
import { yDocToMapDocument } from '../../app/utils/ydocConverter'

export interface ApplyFlushInput {
  body: Buffer
  signature: string
  mapId: string
  authorId: string | null
  secret: string
}

export interface ApplyFlushResult {
  ydocVersion: number
  authorId: string | null
}

export class FlushError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

/**
 * Pure entry point for the PartyKit flush channel. Verifies the HMAC,
 * decodes the Y.Doc, regenerates the JSON snapshot, and atomically updates
 * the Map row. Does not touch h3 event objects so it can be tested directly.
 */
export async function applyFlush(input: ApplyFlushInput): Promise<ApplyFlushResult> {
  const { body, signature, mapId, authorId, secret } = input

  if (!secret) throw new FlushError(500, 'Flush secret not configured')
  if (!verifyFlushSignature(body, signature, secret)) {
    throw new FlushError(401, 'Invalid flush signature')
  }

  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { id: true, title: true, createdAt: true, updatedAt: true, ydocVersion: true }
  })
  if (!map) throw new FlushError(404, 'Map not found')

  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, body)
  const snapshot = yDocToMapDocument(ydoc, {
    id: map.id,
    title: map.title,
    createdAt: map.createdAt.getTime(),
    updatedAt: Date.now()
  })

  const nextVersion = map.ydocVersion + 1
  await prisma.map.update({
    where: { id: mapId },
    data: {
      ydoc: Uint8Array.from(body) as unknown as Uint8Array<ArrayBuffer>,
      ydocVersion: nextVersion,
      data: serializeForJson(snapshot) as object,
      updatedAt: new Date()
    }
  })

  return { ydocVersion: nextVersion, authorId }
}

function serializeForJson(doc: ReturnType<typeof yDocToMapDocument>): Record<string, unknown> {
  return {
    id: doc.id,
    title: doc.title,
    nodes: Array.from(doc.nodes.values()),
    edges: Array.from(doc.edges.values()),
    camera: doc.camera,
    rootNodeId: doc.rootNodeId ?? null,
    settings: doc.settings,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}
