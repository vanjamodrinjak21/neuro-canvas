/** Minimal shape of vue-i18n's `t`, so utils can format without importing i18n. */
type TranslateFn = (key: string, named?: Record<string, unknown>) => string

/**
 * Canonical user initials. Standardizes the several divergent copies that
 * previously lived inline across pages/components (some 1-char, some 2-char,
 * some @-aware).
 *
 * Rules: split on whitespace and `@`; two-or-more tokens → first letter of the
 * first two tokens; a single token → its first letter; empty → `fallback`.
 *
 *   getUserInitials('Vanja Modrinjak')      // 'VM'
 *   getUserInitials('vanja@example.com')    // 'VE'
 *   getUserInitials('Vanja')                // 'V'
 *   getUserInitials('', 'NC')               // 'NC'
 */
export function getUserInitials(nameOrEmail?: string | null, fallback = 'U'): string {
  const source = (nameOrEmail ?? '').trim()
  if (!source) return fallback
  const parts = source.split(/[\s@]+/).filter(Boolean)
  if (parts.length === 0) return fallback
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase()
}

/**
 * Relative-day label for recent timestamps: today / yesterday / N days ago for
 * the last week, then an absolute locale date. Extracted from the identical
 * copies in `maps/index.vue` and `DocumentCard.vue`.
 *
 * Accepts an epoch-millis number or a parseable date string; unparseable input
 * yields an empty string.
 */
export function formatRelativeDay(value: string | number, t: TranslateFn): string {
  const ts = typeof value === 'number' ? value : Date.parse(value)
  if (Number.isNaN(ts)) return ''
  const date = new Date(ts)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return t('common.time.today')
  if (diffDays === 1) return t('common.time.yesterday')
  if (diffDays < 7) return t('common.time.days_ago', { n: diffDays })
  return date.toLocaleDateString()
}
