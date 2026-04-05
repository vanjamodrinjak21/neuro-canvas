import { seedTemplates } from './seed-templates'

async function main() {
  console.log('🌱 Seeding database...')
  await seedTemplates()
  console.log('✅ Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
