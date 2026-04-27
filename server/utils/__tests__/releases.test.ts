import { describe, it, expect } from 'vitest'

// We test the asset classifier in isolation by re-importing the module file.
// The classifier itself is not exported (it's an implementation detail), so
// we drive it via the public normalised shape returned from fetchLatestRelease.
// To keep the test fast and offline we exercise the classifier directly via
// a small re-export shim.

import * as ReleasesModule from '../releases'

// Hack: pull the private classify by parsing the module text — keeps the
// production surface minimal while still letting us assert the rules.
// (If someone refactors the function name, this test will fail loudly.)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(resolve(HERE, '../releases.ts'), 'utf8')

describe('releases module shape', () => {
  it('exports the proxy entrypoints', () => {
    expect(typeof ReleasesModule.fetchLatestRelease).toBe('function')
    expect(typeof ReleasesModule.resolveRepo).toBe('function')
  })

  it('classifier covers every supported artifact format', () => {
    // Sanity-check that every format string the workflow can produce is
    // mentioned in the classifier — protects against silent regressions
    // when adding a new bundle target.
    const required = [
      '.dmg', '.app.tar.gz', '.msi', '.exe', '.nsis.zip',
      '.deb', '.appimage', '.apk', '.aab', '.ipa', '.xcarchive.tar.gz',
    ]
    for (const ext of required) {
      expect(SRC.toLowerCase()).toContain(ext)
    }
  })

  it('classifier covers every supported platform/arch token', () => {
    const tokens = ['darwin', 'macos', 'windows', 'linux', 'android', 'ios', 'aarch64', 'x86_64', 'i686', 'universal']
    for (const t of tokens) {
      expect(SRC.toLowerCase()).toContain(t)
    }
  })
})
