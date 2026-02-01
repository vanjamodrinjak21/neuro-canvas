import bcrypt from 'bcrypt'
import { prisma } from '../../utils/prisma'

interface RegisterBody {
  email: string
  password: string
  name?: string
}

// Password validation
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' }
  }
  return { valid: true }
}

// Email validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event)

  // Validate required fields
  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required'
    })
  }

  // Validate email format
  if (!validateEmail(body.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format'
    })
  }

  // Validate password strength
  const passwordValidation = validatePassword(body.password)
  if (!passwordValidation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: passwordValidation.message
    })
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() }
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists'
    })
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(body.password, 12)

  // Create user
  const user = await prisma.user.create({
    data: {
      email: body.email.toLowerCase(),
      password: hashedPassword,
      name: body.name || null,
      emailVerified: null // Will be set when user verifies email
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  })

  return {
    success: true,
    user
  }
})
