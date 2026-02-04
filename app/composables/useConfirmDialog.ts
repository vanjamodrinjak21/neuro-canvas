import { ref, h, defineComponent, type Component } from 'vue'

export interface ConfirmDialogOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  icon?: string
}

export function useConfirmDialog() {
  const isOpen = ref(false)
  const options = ref<ConfirmDialogOptions>({})
  let resolvePromise: ((value: boolean) => void) | null = null

  function confirm(opts: ConfirmDialogOptions = {}): Promise<boolean> {
    options.value = opts
    isOpen.value = true

    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  function handleConfirm() {
    isOpen.value = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  function handleCancel() {
    isOpen.value = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  // Create a component that renders NcConfirmDialog with bound state
  const ConfirmDialog = defineComponent({
    name: 'ConfirmDialogWrapper',
    setup() {
      return () => h(
        resolveComponent('NcConfirmDialog'),
        {
          open: isOpen.value,
          'onUpdate:open': (value: boolean) => {
            isOpen.value = value
            if (!value && resolvePromise) {
              resolvePromise(false)
              resolvePromise = null
            }
          },
          title: options.value.title,
          description: options.value.description,
          confirmText: options.value.confirmText,
          cancelText: options.value.cancelText,
          variant: options.value.variant,
          icon: options.value.icon,
          onConfirm: handleConfirm,
          onCancel: handleCancel
        }
      )
    }
  }) as Component

  return {
    confirm,
    ConfirmDialog,
    isOpen,
    options
  }
}
