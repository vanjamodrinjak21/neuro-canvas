; ─────────────────────────────────────────────────────────────────────────────
;  NeuroCanvas — NSIS installer hooks (AER-11)
; ─────────────────────────────────────────────────────────────────────────────
;
;  Purpose
;  -------
;  Register the application's custom URL schemes (`neurocanvas://` and the
;  Google reverse-client-ID scheme used for the OAuth desktop flow) at
;  install time, so the browser's "Open NeuroCanvas?" prompt works the very
;  first time the user comes back from Google sign-in — even before they've
;  launched the app.
;
;  Why install-time (and not just runtime)
;  ---------------------------------------
;  `src-tauri/src/lib.rs` already calls `deep_link.register_all()` inside
;  `.setup()` on Windows, which writes the same keys lazily on first launch.
;  That covers portable / dev / sideloaded binaries, but it has two gaps:
;
;    1. The keys aren't written until the user runs the app at least once.
;       If a fresh install kicks off OAuth on first launch (e.g. the user
;       clicks "Sign in with Google" before any other interaction), the
;       browser callback can race the setup hook.
;
;    2. The runtime path only writes HKCU. A per-machine install (admin)
;       should write HKLM so the scheme works for every user on the box.
;
;  This hook closes both gaps. The runtime `register_all()` stays as an
;  idempotent safety net (HKCU is harmless if HKLM already has the same
;  payload — Windows resolves HKLM first for ShellExecute).
;
;  Scope handling (HKLM vs HKCU)
;  ------------------------------
;  Tauri's NSIS template uses MultiUser.nsh and sets `SHCTX` automatically
;  based on the chosen install mode:
;    - `installMode = "perMachine"` or user chose AllUsers in `both` mode
;      → SHCTX = HKLM (machine-wide; visible to every Windows account)
;    - `installMode = "currentUser"` or user chose CurrentUser in `both`
;      → SHCTX = HKCU (current account only; no elevation required)
;
;  Writing to SHCTX is therefore the correct "prefer HKLM, fall back to HKCU"
;  behaviour — the OS-level install scope is the source of truth, not a
;  manual elevation probe.
;
;  Payload
;  -------
;  For each scheme `<s>` we write:
;
;    SHCTX\Software\Classes\<s>                 (Default) = "URL:<s> Protocol"
;    SHCTX\Software\Classes\<s>                 URL Protocol = ""
;    SHCTX\Software\Classes\<s>\DefaultIcon    (Default) = "<exe>,0"
;    SHCTX\Software\Classes\<s>\shell\open\command (Default) = "\"<exe>\" \"%1\""
;
;  The `"%1"` arg is the full URL — Tauri's single-instance plugin
;  (`tauri-plugin-single-instance` with the `deep-link` feature) forwards it
;  into the deep-link plugin's `deep-link://new-url` event so the existing
;  `onOpenUrl` JS listener fires.
;
;  Uninstall
;  ---------
;  PREUNINSTALL removes both scheme trees from SHCTX so we don't leave
;  registry pollution behind. We delete the whole subkey (DeleteRegKey) to
;  also remove DefaultIcon and shell\open\command children in one shot.
;  This runs before file deletion so the registry is consistent even if the
;  uninstaller fails partway through.
;
;  Idempotency
;  -----------
;  WriteRegStr overwrites silently, so re-running the installer (upgrade /
;  repair) is safe. DeleteRegKey is a no-op when the key doesn't exist, so
;  uninstall is also safe to retry.
;
;  WiX / MSI
;  ---------
;  WiX is NOT currently configured for this project (`bundle.windows.wix` is
;  absent from tauri.conf.json — only NSIS is enabled). When/if a WiX target
;  is added, mirror these registrations via WiX `<RegistryValue>` elements
;  in a fragment file referenced from the WiX config (Tauri v2 supports
;  `bundle.windows.wix.fragmentPaths`). The same SHCTX-equivalent logic
;  applies — WiX uses `Component` `KeyPath` and `<MajorUpgrade>` cleanup
;  semantics rather than manual delete.
;
; ─────────────────────────────────────────────────────────────────────────────

; The two custom schemes — must stay in lock-step with:
;   - src-tauri/tauri.conf.json    `plugins.deep-link.desktop.schemes`
;   - src-tauri/src/lib.rs         `register_all()` runtime fallback
!define NEUROCANVAS_SCHEME "neurocanvas"
!define GOOGLE_OAUTH_SCHEME "com.googleusercontent.apps.1025021574887-effk89v1d8s52cjgc4m7mi4nmipruk6c"


; ── Helper: register a single scheme under SHCTX\Software\Classes\<scheme> ──
;
; Uses Tauri's `${MAINBINARYNAME}` macro for the exe filename so a rebrand
; (productName change in tauri.conf.json) doesn't desync this file.
!macro RegisterNeuroCanvasScheme SCHEME
  DetailPrint "Registering URL scheme: ${SCHEME}"

  ; Root key — declares the scheme as a URL protocol handler
  WriteRegStr SHCTX "Software\Classes\${SCHEME}" "" "URL:${SCHEME} Protocol"
  WriteRegStr SHCTX "Software\Classes\${SCHEME}" "URL Protocol" ""

  ; DefaultIcon — uses the app exe's first icon resource
  WriteRegStr SHCTX "Software\Classes\${SCHEME}\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"

  ; shell\open\command — what ShellExecute calls when the OS opens the URL.
  ; `"%1"` is the deep-link URL; the quotes are required so URLs containing
  ; spaces (rare, but legal in OAuth state params) reach the app intact.
  WriteRegStr SHCTX "Software\Classes\${SCHEME}\shell" "" ""
  WriteRegStr SHCTX "Software\Classes\${SCHEME}\shell\open" "" ""
  WriteRegStr SHCTX "Software\Classes\${SCHEME}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
!macroend


; ── Helper: remove a scheme tree (idempotent — no-op if absent) ────────────
!macro UnregisterNeuroCanvasScheme SCHEME
  DetailPrint "Removing URL scheme: ${SCHEME}"
  DeleteRegKey SHCTX "Software\Classes\${SCHEME}"
!macroend


; ─── Hooks ────────────────────────────────────────────────────────────────

!macro NSIS_HOOK_PREINSTALL
  ; Reserved for future use (e.g. dependency probes). Intentionally empty —
  ; we don't want any UI here that might block silent / unattended installs
  ; (CI pipelines run with `/S` for unattended).
!macroend


!macro NSIS_HOOK_POSTINSTALL
  ; Register both schemes immediately after the installer copies the binary
  ; into $INSTDIR. This runs once per install/upgrade.
  !insertmacro RegisterNeuroCanvasScheme "${NEUROCANVAS_SCHEME}"
  !insertmacro RegisterNeuroCanvasScheme "${GOOGLE_OAUTH_SCHEME}"
!macroend


!macro NSIS_HOOK_PREUNINSTALL
  ; Remove scheme keys before file deletion so the registry is consistent
  ; even if uninstall fails halfway through. The whole subtree (including
  ; DefaultIcon and shell\open\command) goes with DeleteRegKey.
  !insertmacro UnregisterNeuroCanvasScheme "${NEUROCANVAS_SCHEME}"
  !insertmacro UnregisterNeuroCanvasScheme "${GOOGLE_OAUTH_SCHEME}"
!macroend


!macro NSIS_HOOK_POSTUNINSTALL
  ; Nothing to do — scheme cleanup already ran in PREUNINSTALL.
!macroend
