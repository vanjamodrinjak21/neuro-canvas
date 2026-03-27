import { nanoid } from 'nanoid'

const STORAGE_KEY = 'nc-device-id'

let _deviceId: string | null = null

export function useDeviceId(): { deviceId: string } {
  if (_deviceId) return { deviceId: _deviceId }

  if (typeof window !== 'undefined') {
    _deviceId = localStorage.getItem(STORAGE_KEY)
    if (!_deviceId) {
      _deviceId = nanoid(12)
      localStorage.setItem(STORAGE_KEY, _deviceId)
    }
  } else {
    _deviceId = 'ssr'
  }

  return { deviceId: _deviceId }
}
