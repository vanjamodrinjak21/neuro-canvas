import type { Template } from '~/types'

/**
 * Localizes the titles/descriptions of built-in (system) templates.
 *
 * System templates are seeded in English in the database, so on a non-English
 * locale their cards would otherwise stay English. We map each built-in's
 * `slug` to an i18n key (`templates.builtin.<slug>.title|.description`) and
 * fall back to the database value when no translation exists — so
 * user-published templates (which aren't localizable) pass straight through.
 *
 * The template `category` badge is localized via the existing
 * `templates.filter.<category>` keys.
 */
export function useBuiltinTemplateText() {
  const { t, te } = useI18n()

  function title(tmpl: Pick<Template, 'slug' | 'title' | 'isSystem'>): string {
    if (tmpl.isSystem) {
      const key = `templates.builtin.${tmpl.slug}.title`
      if (te(key)) return t(key)
    }
    return tmpl.title
  }

  function description(tmpl: Pick<Template, 'slug' | 'description' | 'isSystem'>): string {
    if (tmpl.isSystem) {
      const key = `templates.builtin.${tmpl.slug}.description`
      if (te(key)) return t(key)
    }
    return tmpl.description ?? ''
  }

  function category(cat: string): string {
    const key = `templates.filter.${cat}`
    return te(key) ? t(key) : cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  return { title, description, category }
}
