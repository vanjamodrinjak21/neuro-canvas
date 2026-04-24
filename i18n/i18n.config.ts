export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  missingWarn: process.env.NODE_ENV === 'development',
  fallbackWarn: false
}))
