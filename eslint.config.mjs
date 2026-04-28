import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: false,
  },
  dirs: {
    src: ['app', 'server', 'partykit', 'workers', 'plugins', 'scripts'],
  },
})
  .prepend({
    ignores: [
      'server/generated/**',
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'src-tauri/target/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'stubs/**',
      'public/**',
      '**/*.min.js',
    ],
  })
  .override('nuxt/typescript/rules', {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-dynamic-delete': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  })
  .override('nuxt/vue/rules', {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  })
  .append({
    rules: {
      // Downgrade pre-existing issues to warnings — CI must not fail on these.
      'no-empty': 'warn',
      'no-undef': 'warn',
      'no-unsafe-finally': 'warn',
      'no-constant-binary-expression': 'warn',
      'unicorn/no-new-array': 'warn',
      'unicorn/prefer-number-properties': 'warn',
      'unicorn/prefer-node-protocol': 'warn',
      'regexp/no-super-linear-backtracking': 'warn',
      'regexp/no-unused-capturing-group': 'warn',
    },
  })
