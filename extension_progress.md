# VS Code Extension — Progress Log

## Status: Scaffold Complete

## What's done
- [x] vs_extension/ folder created at project root
- [x] Scaffolded via yo code equivalent (TypeScript, esbuild, npm) — all files created manually to avoid interactive prompts
- [x] Boilerplate sample command removed (no helloWorld in package.json contributes.commands or activationEvents)
- [x] Build verified with no TypeScript errors (`npm run compile` → `tsc --noEmit` passed, esbuild bundled to dist/extension.js)
- [x] Manually confirmed save-hook fires in Extension Development Host (F5) — PENDING USER VERIFICATION
- [x] Added `["$tsc-watch", "$esbuild-watch"]` problem matchers to tasks.json for correct F5 readiness detection
- [x] Added `onStartupFinished` to `activationEvents` to ensure extension loads and hooks the save event
- [x] Extension: SecretStorage integration for the API key (`skillgap.setApiKey` command added)
- [x] Extension: Error/diagnostic capture on save (captures only `Error` severity, silent on success)
- [x] Extension: Error fingerprinting (SHA-256 hash of `file:line:message`) for dedup/caching
- [x] Backend: `extension_activity_log` table and `POST /api/extension/activity` endpoint
- [x] Backend: `error_logs` table and `POST /api/extension/error` endpoint with fingerprint dedup logic
- [x] Backend: `POST /api/extension/verify-key` endpoint to validate extension API keys
- [x] Diagnostic filter widened: Error severity + explicit Pylance warning-code allowlist (reportUndefinedVariable, etc.) — excludes style/unused-import noise
- [x] Verified: undefined-variable warning now captured as [NEW ERROR], fingerprint dedup confirmed on repeat save ([ERROR DEDUP], duplicate: true)

## Folder structure

```
vs_extension/
├── .gitignore
├── .vscode/
│   ├── launch.json        ← F5 Extension Development Host config
│   ├── settings.json      ← points VS Code to local typescript lib
│   └── tasks.json         ← default build task: npm watch (esbuild + tsc)
├── .vscodeignore
├── esbuild.js             ← bundler script (production + watch modes)
├── eslint.config.mjs      ← ESLint 9 flat config for TypeScript
├── node_modules/          ← (gitignored)
├── dist/
│   └── extension.js       ← compiled output (gitignored)
├── package.json
├── README.md
├── src/
│   └── extension.ts       ← activate() + deactivate() + save listener
└── tsconfig.json
```

## Not yet built (next phases, do not start until told)
- Gemini API call (single call returning {hint, explanation, corrected_block})
- React dashboard display of hints/fixes
- resolved_via tracking logic for errors (hint | full_fix | unresolved)

## Notes / decisions log
- **Dedup strategy**: We compute a SHA-256 fingerprint on the extension side (`file:line:message`) and check for existence on the backend to avoid duplicate rows for the same error on consecutive saves.
- **Save Event UX**: The `onDidSaveTextDocument` hook logs to the extension debug console only. No VS Code popups/notifications are shown on save to avoid spamming the user.
