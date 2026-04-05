import type {
  Template,
  TemplateWithData,
  TemplateFilters,
  TemplateCategory,
  TemplateSortBy,
  PublishTemplatePayload,
  AIAdaptPayload,
} from '~/types'

export function useTemplates() {
  const templates = ref<Template[]>([])
  const myTemplates = ref<Template[]>([])
  const currentTemplate = ref<TemplateWithData | null>(null)
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = reactive<TemplateFilters>({
    category: 'all',
    search: '',
    sortBy: 'popular',
    myTemplates: false,
  })

  async function fetchTemplates(page = 1) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, string> = {
        page: String(page),
        sortBy: filters.sortBy,
      }
      if (filters.category !== 'all') params.category = filters.category
      if (filters.search) params.search = filters.search

      const data = await $fetch<{ templates: Template[]; total: number }>('/api/templates', { params })
      templates.value = data.templates
      total.value = data.total
    } catch (e: any) {
      error.value = e.data?.statusMessage || 'Failed to load templates'
    } finally {
      loading.value = false
    }
  }

  async function fetchMyTemplates() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ templates: Template[] }>('/api/templates/my')
      myTemplates.value = data.templates
    } catch (e: any) {
      error.value = e.data?.statusMessage || 'Failed to load your templates'
    } finally {
      loading.value = false
    }
  }

  async function fetchTemplate(slug: string) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch(`/api/templates/${slug}`)
      currentTemplate.value = data as TemplateWithData
    } catch (e: any) {
      error.value = e.data?.statusMessage || 'Template not found'
      currentTemplate.value = null
    } finally {
      loading.value = false
    }
  }

  async function publishTemplate(payload: PublishTemplatePayload) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch('/api/templates/publish', {
        method: 'POST',
        body: payload,
      })
      return data
    } catch (e: any) {
      error.value = e.data?.statusMessage || 'Failed to publish template'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function useTemplate(slug: string, title?: string) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ mapId: string; title: string }>(`/api/templates/${slug}/use`, {
        method: 'POST',
        body: { title },
      })
      return data
    } catch (e: any) {
      error.value = e.data?.statusMessage || 'Failed to use template'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function adaptTemplate(payload: AIAdaptPayload) {
    loading.value = true
    error.value = null
    try {
      const slug = currentTemplate.value?.slug
      if (!slug) throw new Error('No template selected')

      const data = await $fetch(`/api/templates/${slug}/adapt`, {
        method: 'POST',
        body: {
          topic: payload.topic,
          depth: payload.depth,
          style: payload.style,
          domain: payload.domain,
        },
      })
      return data
    } catch (e: any) {
      error.value = e.data?.statusMessage || 'Failed to adapt template'
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCategory(category: TemplateCategory | 'all') {
    filters.category = category
  }

  function setSearch(search: string) {
    filters.search = search
  }

  function setSortBy(sortBy: TemplateSortBy) {
    filters.sortBy = sortBy
  }

  // Auto-fetch when filters change
  watch(
    () => [filters.category, filters.search, filters.sortBy],
    () => {
      if (filters.myTemplates) {
        fetchMyTemplates()
      } else {
        fetchTemplates()
      }
    },
  )

  return {
    // State
    templates,
    myTemplates,
    currentTemplate,
    total,
    loading,
    error,
    filters,
    // Actions
    fetchTemplates,
    fetchMyTemplates,
    fetchTemplate,
    publishTemplate,
    useTemplate,
    adaptTemplate,
    setCategory,
    setSearch,
    setSortBy,
  }
}
