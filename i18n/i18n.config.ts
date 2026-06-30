// Eager-bundled locale messages.
//
// Why eager (not lazy code-split): this app is a SPA (`ssr: false`). With
// per-locale lazy `files`, switching to a locale whose JSON chunks weren't
// loaded yet leaves the locale active while its messages are still in-flight,
// so `t()` renders raw keys for a few seconds (flash of untranslated content)
// until the dynamic import resolves. With only two locales (~100 KB each,
// far smaller gzipped) the wire saving isn't worth that UX bug, so both
// locales are bundled into the entry and messages are always synchronously
// present — no flash on switch, navigation, cold-start, or native launch.
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enLanding from './locales/en/landing.json'
import enDashboard from './locales/en/dashboard.json'
import enCanvas from './locales/en/canvas.json'
import enSettings from './locales/en/settings.json'
import enTemplates from './locales/en/templates.json'
import enLegal from './locales/en/legal.json'
import enRoadmap from './locales/en/roadmap.json'
import enDocuments from './locales/en/documents.json'
import enMobile from './locales/en/mobile.json'

import hrCommon from './locales/hr/common.json'
import hrAuth from './locales/hr/auth.json'
import hrLanding from './locales/hr/landing.json'
import hrDashboard from './locales/hr/dashboard.json'
import hrCanvas from './locales/hr/canvas.json'
import hrSettings from './locales/hr/settings.json'
import hrTemplates from './locales/hr/templates.json'
import hrLegal from './locales/hr/legal.json'
import hrRoadmap from './locales/hr/roadmap.json'
import hrDocuments from './locales/hr/documents.json'
import hrMobile from './locales/hr/mobile.json'

const en = {
  ...enCommon,
  ...enAuth,
  ...enLanding,
  ...enDashboard,
  ...enCanvas,
  ...enSettings,
  ...enTemplates,
  ...enLegal,
  ...enRoadmap,
  ...enDocuments,
  ...enMobile
}

const hr = {
  ...hrCommon,
  ...hrAuth,
  ...hrLanding,
  ...hrDashboard,
  ...hrCanvas,
  ...hrSettings,
  ...hrTemplates,
  ...hrLegal,
  ...hrRoadmap,
  ...hrDocuments,
  ...hrMobile
}

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  missingWarn: process.env.NODE_ENV === 'development',
  fallbackWarn: false,
  messages: { en, hr }
}))
