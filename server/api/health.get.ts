import { prisma } from '../utils/prisma'
import { redis } from '../utils/redis'

export default defineEventHandler(async () => {
  const health: {
    status: 'ok' | 'degraded' | 'error'
    timestamp: string
    services: {
      database: 'ok' | 'error'
      redis: 'ok' | 'error'
    }
    version: string
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'ok',
      redis: 'ok'
    },
    version: process.env.npm_package_version || '1.0.0'
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    health.services.database = 'error'
    health.status = 'degraded'
  }

  // Check Redis
  try {
    await redis.ping()
  } catch {
    health.services.redis = 'error'
    health.status = 'degraded'
  }

  // If both services are down, status is error
  if (health.services.database === 'error' && health.services.redis === 'error') {
    health.status = 'error'
  }

  return health
})
