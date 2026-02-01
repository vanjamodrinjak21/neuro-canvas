import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.neurocanvas.app',
  appName: 'NeuroCanvas',
  webDir: '.output/public',
  server: {
    // Use this for development with hot reload
    // url: 'http://localhost:3000',
    // cleartext: true
  },
  plugins: {
    Filesystem: {
      requestLegacyExternalStorage: true
    },
    Haptics: {
      enabled: true
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#032221'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#032221',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'NeuroCanvas',
    backgroundColor: '#032221'
  },
  android: {
    backgroundColor: '#032221',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
}

export default config
