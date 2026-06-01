# NeuroCanvas — Development Notes

Operational notes for things that aren't obvious from the code alone. Cross-references the AER-* Linear issues where applicable.

---

## Desktop updater signing (AER-14)

The Tauri v2 updater uses minisign signatures to verify that an update bundle came from us before installing it. The public key is committed to `src-tauri/tauri.conf.json`; the private key lives outside the repo and is added to GitHub Actions as a secret.

### One-time keypair generation (done — for reference only)

```bash
# Generate a fresh keypair, password-protected. The password is required
# at sign time but is also baked into the GitHub Actions secret.
KEY_PW="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
echo "$KEY_PW" > ~/.tauri/neurocanvas.key.password
chmod 600 ~/.tauri/neurocanvas.key.password

npx @tauri-apps/cli signer generate \
  -w ~/.tauri/neurocanvas.key \
  -p "$KEY_PW" \
  --ci
```

Outputs:

- `~/.tauri/neurocanvas.key` — **private key** (KEEP SECRET, never commit)
- `~/.tauri/neurocanvas.key.pub` — public key (already committed to `tauri.conf.json` under `plugins.updater.pubkey`)
- `~/.tauri/neurocanvas.key.password` — the password (KEEP SECRET, never commit)

> The key files live in `~/.tauri/` (outside the repo) and the filename patterns are additionally added to `.git/info/exclude` as a safety net.

### Required GitHub Actions secrets

The `release.yml` workflow needs these two secrets on every desktop build (already wired — they just need to be populated):

| Secret name                              | Value                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `TAURI_SIGNING_PRIVATE_KEY`              | Contents of `~/.tauri/neurocanvas.key` (the whole file, as text)   |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`     | Contents of `~/.tauri/neurocanvas.key.password`                    |

Add via:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY          < ~/.tauri/neurocanvas.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD < ~/.tauri/neurocanvas.key.password
```

Until these are set, `tauri build` will skip emitting `.sig` files and the `write-manifest` job will print a `::warning::` per platform but still produce a manifest (with empty `signature` fields — the in-app updater will refuse to install such an update, which is the safe failure mode).

### How signatures flow through the release pipeline

1. **`build-tauri` job** sets `TAURI_SIGNING_*` env on the `tauri-action@v0` step. Tauri v2's `tauri build` auto-generates a `.sig` file next to each updater bundle (`*.app.tar.gz.sig` on macOS, `*-setup.exe.sig` on Windows) when those env vars are present.
2. **Stage updater signatures** step picks the canonical updater `.sig` for the platform being built and uploads it as a workflow artifact named `updater-sigs-<target>`.
3. **`write-manifest` job** downloads all platform artifacts, reads each `.sig` (the file content IS the base64 signature, ready to paste), and embeds it into `latest.json` under `platforms.<os>-<arch>.signature`.
4. The resulting `latest.json` is uploaded to R2 at `https://cdn.neuro-canvas.com/beta/latest.json`. The desktop app's `tauri-plugin-updater` reads this URL on launch and every 6 hours, verifies the signature against the baked-in pubkey, then prompts the user.

### Key rotation

If the private key is ever leaked, suspected of being on a compromised
machine, or you simply need to roll the key on a schedule:

1. **Generate** a new keypair with the procedure above (writes to `~/.tauri/`,
   which is gitignored — see *Why we don't commit the private key* below).
2. **Replace** `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` with
   the contents of the new `~/.tauri/neurocanvas.key.pub` and commit it.
3. **Rotate** the two GitHub Actions secrets:

   ```bash
   gh secret set TAURI_SIGNING_PRIVATE_KEY          < ~/.tauri/neurocanvas.key
   gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD < ~/.tauri/neurocanvas.key.password
   ```

4. **Ship** a new tagged release (`git tag v1.0.1 && git push origin v1.0.1`).
   CI's *Sync version with release tag* step pins package.json +
   tauri.conf.json to the tag, builds, signs with the new key, and publishes
   a fresh `latest.json` to R2.
5. **Announce** out-of-band (changelog, in-app banner, email) that users on
   pre-rotation builds **must** download manually from `/download`. **Old
   installs will be permanently unable to auto-update** — the new manifest
   signatures won't verify against their baked-in old pubkey. That's by
   design; it's what makes signing meaningful, so plan the rollout.

### Why we don't commit the private key

The private key + password are what GitHub Actions uses to sign every
binary. If they leak, an attacker can ship a malicious update that the
in-app updater will happily verify and install (it only checks the
signature, not the author).

`.gitignore` already excludes these paths as a safety net:

```
*.tauri.key
*.tauri.key.pub
*.tauri.key.password
neurocanvas.key
neurocanvas.key.pub
neurocanvas.key.password
~/.tauri/
```

…but the real defense is keeping the files outside the repo entirely
(`~/.tauri/`). If you ever accidentally commit one of these files:
rotate immediately (procedure above), even if you push-force the commit
out. Treat any window where the key was visible on a public repo as a
full compromise.

---

## Cross-platform update notifications (AER-14)

Three platforms, one composable: `app/composables/useAppUpdates.ts`.

| Platform   | Detection                                          | Update channel                                  | CTA action                              |
| ---------- | -------------------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| Tauri      | `__TAURI__` / `__TAURI_INTERNALS__` on `window`    | `tauri-plugin-updater` + signed `latest.json`   | Download, install, relaunch             |
| Capacitor  | `Capacitor.isNativePlatform()` returning true      | `/api/releases/manifest` poll (version only)    | Open App Store / Play Store via Browser |
| Web        | Fallback                                           | `/api/releases/manifest` poll (version only)    | `window.location.reload()`              |

`UpdateNotification.vue` is mounted once in `app/app.vue` and consumes the composable — no platform branching in the template.

The "Auto-check for updates" toggle in **Settings → General** is backed by `localStorage['nc-auto-update']` (default `true`). When off, background polling is skipped but the "Check now" button in settings still works.

### Banner dismissal

Per-version, per-session: dismissing a banner stores the version in `sessionStorage['nc-update-dismissed-version']`. The banner stays hidden for the rest of the tab session but reappears next time the user opens the app — by design, so users can't permanently hide a critical update.

---

## Local Tauri dev

```bash
# First run only — generate Prisma client + Nuxt types
npm install
npx prisma generate

# Run Tauri dev (uses scripts/tauri-dev.sh, which boots the Nuxt dev server first)
npm run tauri:dev
```

On macOS the first build downloads ONNX Runtime binaries via `download-binaries` — give it a minute. Subsequent builds are cached.

---

## Notes for future contributors

- **Never** force-push to `main` or `beta` tags — both trigger releases.
- The `beta` tag is the rolling channel. The release workflow deletes & recreates the GitHub release for that tag on every push; that's intentional.
- Semver tags (`v1.2.3`, `v1.2.3-rc.1`) trigger a fresh, immutable release.
- The updater pubkey rotation procedure (above) is destructive for already-installed apps. Don't rotate casually.
