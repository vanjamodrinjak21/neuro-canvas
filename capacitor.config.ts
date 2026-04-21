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
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
      electronIsEncryption: false
    },
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
      backgroundColor: '#09090B'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#09090B',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'NeuroCanvas',
    backgroundColor: '#09090B'
  },
  android: {
    backgroundColor: '#09090B',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
}

export default config
