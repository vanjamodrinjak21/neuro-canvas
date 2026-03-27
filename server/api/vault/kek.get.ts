import { requireAuthSession } from '../../utils/syncHelpers'
import { deriveUserKEK } from '../../utils/encryption'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const kek = deriveUserKEK(userId)
  return { kek }
})
