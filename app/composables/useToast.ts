/**
 * Lightweight, dependency-free toast system.
 *
 * Singleton-by-module — `toasts` lives in module scope so every
 * `useToast()` call shares the same list. Mount `<Toast />` once
 * at the root of the app to render them.
 *
 * Usage:
 *   const { error, success, info, warning, dismiss } = useToast()
 *   error('Something went wrong')
 *   success('Saved', 2000)
 */

import { ref, type Ref } from 'vue'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  ttl: number
}

// Singleton state — declared outside the composable so every caller
// sees the same reactive list.
const toasts: Ref<Toast[]> = ref<Toast[]>([])
let _id = 0

function push(kind: ToastKind, message: string, ttl = 4000): number {
  const id = ++_id
  toasts.value = [...toasts.value, { id, kind, message, ttl }]
  if (ttl > 0 && typeof window !== 'undefined') {
    setTimeout(() => dismiss(id), ttl)
  }
  return id
}

function dismiss(id: number): void {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

export interface ToastApi {
  toasts: Ref<Toast[]>
  info: (message: string, ttl?: number) => number
  success: (message: string, ttl?: number) => number
  warning: (message: string, ttl?: number) => number
  error: (message: string, ttl?: number) => number
  dismiss: (id: number) => void
}

export function useToast(): ToastApi {
  return {
    toasts,
    info: (m: string, ttl?: number) => push('info', m, ttl),
    success: (m: string, ttl?: number) => push('success', m, ttl),
    warning: (m: string, ttl?: number) => push('warning', m, ttl),
    error: (m: string, ttl?: number) => push('error', m, ttl),
    dismiss,
  }
}
