import type { Platform } from '~/types'

/**
 * Platform Abstraction Layer (PAL)
 * Provides unified API for platform-specific features
 */
export function usePlatform() {
  // Detect current platform
  const platform = computed<Platform>(() => {
    if (typeof window === 'undefined') return 'web'

    // Check for Tauri
    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
      return 'tauri'
    }

    // Check for Capacitor
    if ('Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()) {
      return 'capacitor'
    }

    return 'web'
  })

  const isTauri = computed(() => platform.value === 'tauri')
  const isCapacitor = computed(() => platform.value === 'capacitor')
  const isWeb = computed(() => platform.value === 'web')
  const isNative = computed(() => isTauri.value || isCapacitor.value)
  const isMobile = computed(() => {
    if (isCapacitor.value) return true
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  })

  // File System API
  const fs = {
    async readFile(path: string): Promise<Uint8Array> {
      if (isTauri.value) {
        const { readFile } = await import('@tauri-apps/plugin-fs')
        return await readFile(path)
      }

      if (isCapacitor.value) {
        const { Filesystem, Encoding } = await import('@capacitor/filesystem')
        const result = await Filesystem.readFile({ path })
        // Convert base64 to Uint8Array
        const binary = atob(result.data as string)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        return bytes
      }

      // Web: Use OPFS
      const root = await navigator.storage.getDirectory()
      const file = await root.getFileHandle(path)
      const fileData = await file.getFile()
      return new Uint8Array(await fileData.arrayBuffer())
    },

    async writeFile(path: string, data: Uint8Array): Promise<void> {
      if (isTauri.value) {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        await writeFile(path, data)
        return
      }

      if (isCapacitor.value) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        // Convert Uint8Array to base64
        let binary = ''
        data.forEach(byte => binary += String.fromCharCode(byte))
        const base64 = btoa(binary)
        await Filesystem.writeFile({
          path,
          data: base64,
          directory: Directory.Documents
        })
        return
      }

      // Web: Use OPFS
      const root = await navigator.storage.getDirectory()
      const file = await root.getFileHandle(path, { create: true })
      const writable = await file.createWritable()
      await writable.write(data as unknown as ArrayBuffer)
      await writable.close()
    },

    async deleteFile(path: string): Promise<void> {
      if (isTauri.value) {
        const { remove } = await import('@tauri-apps/plugin-fs')
        await remove(path)
        return
      }

      if (isCapacitor.value) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.deleteFile({
          path,
          directory: Directory.Documents
        })
        return
      }

      // Web: Use OPFS
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(path)
    },

    async exists(path: string): Promise<boolean> {
      try {
        if (isTauri.value) {
          const { exists } = await import('@tauri-apps/plugin-fs')
          return await exists(path)
        }

        if (isCapacitor.value) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem')
          try {
            await Filesystem.stat({ path, directory: Directory.Documents })
            return true
          } catch {
            return false
          }
        }

        // Web: Use OPFS
        const root = await navigator.storage.getDirectory()
        try {
          await root.getFileHandle(path)
          return true
        } catch {
          return false
        }
      } catch {
        return false
      }
    }
  }

  // Dialog API
  const dialog = {
    async alert(message: string, title = 'NeuroCanvas'): Promise<void> {
      if (isTauri.value) {
        const { message: tauriMessage } = await import('@tauri-apps/plugin-dialog')
        await tauriMessage(message, { title })
        return
      }

      if (isCapacitor.value) {
        const { Dialog } = await import('@capacitor/dialog')
        await Dialog.alert({ title, message })
        return
      }

      // Web fallback
      window.alert(message)
    },

    async confirm(message: string, title = 'NeuroCanvas'): Promise<boolean> {
      if (isTauri.value) {
        const { ask } = await import('@tauri-apps/plugin-dialog')
        return await ask(message, { title })
      }

      if (isCapacitor.value) {
        const { Dialog } = await import('@capacitor/dialog')
        const result = await Dialog.confirm({ title, message })
        return result.value
      }

      // Web fallback
      return window.confirm(message)
    },

    async prompt(message: string, defaultValue = '', title = 'NeuroCanvas'): Promise<string | null> {
      if (isCapacitor.value) {
        const { Dialog } = await import('@capacitor/dialog')
        const result = await Dialog.prompt({ title, message, inputText: defaultValue })
        return result.cancelled ? null : result.value
      }

      // Web/Tauri fallback
      return window.prompt(message, defaultValue)
    },

    async openFile(options?: {
      filters?: Array<{ name: string; extensions: string[] }>
      multiple?: boolean
    }): Promise<string | string[] | null> {
      if (isTauri.value) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        return await open({
          multiple: options?.multiple,
          filters: options?.filters
        })
      }

      // Web: Use file input
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = options?.multiple ?? false
        if (options?.filters) {
          input.accept = options.filters
            .flatMap(f => f.extensions.map(e => `.${e}`))
            .join(',')
        }
        input.onchange = () => {
          if (!input.files?.length) {
            resolve(null)
            return
          }
          if (options?.multiple) {
            resolve(Array.from(input.files).map(f => URL.createObjectURL(f)))
          } else {
            const file = input.files[0]
            resolve(file ? URL.createObjectURL(file) : null)
          }
        }
        input.click()
      })
    },

    async saveFile(options?: {
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }): Promise<string | null> {
      if (isTauri.value) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        return await save({
          defaultPath: options?.defaultPath,
          filters: options?.filters
        })
      }

      // Web: Return default path or prompt
      return options?.defaultPath ?? 'untitled'
    }
  }

  // Haptics API
  const haptics = {
    async impact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
      if (isCapacitor.value) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
        const styleMap = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy
        }
        await Haptics.impact({ style: styleMap[style] })
        return
      }

      // Web: Use vibration API if available
      if ('vibrate' in navigator) {
        const duration = style === 'light' ? 10 : style === 'medium' ? 20 : 30
        navigator.vibrate(duration)
      }
    },

    async notification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
      if (isCapacitor.value) {
        const { Haptics, NotificationType } = await import('@capacitor/haptics')
        const typeMap = {
          success: NotificationType.Success,
          warning: NotificationType.Warning,
          error: NotificationType.Error
        }
        await Haptics.notification({ type: typeMap[type] })
        return
      }

      // Web: Use vibration API
      if ('vibrate' in navigator) {
        const pattern = type === 'success' ? [10, 50, 10] : type === 'warning' ? [30, 50, 30] : [50, 50, 50, 50, 50]
        navigator.vibrate(pattern)
      }
    },

    async selection(): Promise<void> {
      if (isCapacitor.value) {
        const { Haptics } = await import('@capacitor/haptics')
        await Haptics.selectionStart()
        await Haptics.selectionEnd()
        return
      }

      // Web: Light vibration
      if ('vibrate' in navigator) {
        navigator.vibrate(5)
      }
    }
  }

  // Share API
  const share = {
    async canShare(): Promise<boolean> {
      if (isCapacitor.value) return true
      return 'share' in navigator
    },

    async share(options: {
      title?: string
      text?: string
      url?: string
      files?: File[]
    }): Promise<void> {
      if (isCapacitor.value) {
        const { Share } = await import('@capacitor/share')
        await Share.share({
          title: options.title,
          text: options.text,
          url: options.url
        })
        return
      }

      // Web Share API
      if ('share' in navigator) {
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url,
          files: options.files
        })
      }
    }
  }

  // GPU Detection
  const gpu = {
    async hasWebGPU(): Promise<boolean> {
      if (typeof navigator === 'undefined') return false
      if (!('gpu' in navigator)) return false

      try {
        const adapter = await (navigator as any).gpu.requestAdapter()
        return adapter !== null
      } catch {
        return false
      }
    },

    hasWebGL2(): boolean {
      if (typeof document === 'undefined') return false
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      return gl !== null
    }
  }

  return {
    platform,
    isTauri,
    isCapacitor,
    isWeb,
    isNative,
    isMobile,
    fs,
    dialog,
    haptics,
    share,
    gpu
  }
}
