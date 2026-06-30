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
    // Route fetch() / XHR through native HTTP so direct calls to
    // api.anthropic.com / api.openai.com from the Capacitor origin
    // bypass WKWebView CORS preflight and don't fail silently.
    CapacitorHttp: {
      enabled: true
    },
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
      // Overlay the web view so the (theme-colored) page background shows behind
      // the status bar instead of a solid dark bar. Do NOT set a static
      // backgroundColor here — it forces an opaque bar and leaves a black strip
      // in light mode. The runtime plugin (capacitor-native.client.ts) sets the
      // style (text color) + Android bg per theme.
      overlaysWebView: true,
      style: 'dark'
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
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
