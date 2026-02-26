# dding-dong

Claude Code notification plugin. Plays sounds and sends OS notifications on task completion, errors, and input requests.
Zero npm dependencies — uses only Node.js built-in modules.

## Development Commands

```bash
# Test notifications (cycles through all event types)
node scripts/notify.mjs test

# Regenerate default sound pack WAV files
node scripts/generate-sounds.mjs

# Detect platform, audio player, and notifier
node scripts/setup-wizard.mjs detect

# Validate config files (JSON parsing, required keys, sound pack existence)
node scripts/setup-wizard.mjs validate

# Sound pack management (discover, validate, create, clone, apply)
node scripts/pack-wizard.mjs discover

# Version sync (plugin.json → marketplace.json)
node scripts/sync-version.mjs sync
node scripts/sync-version.mjs verify
node scripts/sync-version.mjs bump patch   # or minor, major

# Website (pnpm required — do NOT use npm/yarn)
cd website && pnpm install    # Install dependencies
cd website && pnpm dev        # Dev server (auto-copies sound files)
cd website && pnpm build      # Production build
```

## Design Rules

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **Root cause fixes**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Stop hook MUST respond**: `stop.mjs` must write `{}` (empty JSON object) to stdout. Missing this halts Claude execution.
- **Always exit(0) on error**: Notification failure must never block Claude. All hook catch blocks call `process.exit(0)`.
- **detached + unref**: Audio processes use `spawn(..., { detached: true, stdio: 'ignore' }).unref()` to complete within the 5-second hook timeout.
- **ESM only**: All scripts use `.mjs` extension with `import`/`export` syntax.
- **No npm dependencies**: Only Node.js built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:os`, `node:url`).

## Gotchas & Landmines

### Hook Timing
- hooks.json 5s timeout → internal safety timer 4s → stdin read 2s → only ~2s left for notify()
- Only the stop hook requires `{}` response (Claude awaits it). All other hooks need no response
- `uncaughtException`/`unhandledRejection` handlers guarantee response then `exit(0)` — last-resort safety net

### Config
- 5-stage merge (later wins): Default ← Global ← Project ← Local ← env vars
- `_meta`: extracted before deepMerge, re-attached after. Global-only. Cannot be polluted by project config
- `null` in deepMerge = key deletion. `{ "sound": null }` → removes the sound key entirely. To disable, use `{ "sound": { "enabled": false } }`
- Project/Local scopes store diff-only overrides (not full snapshots)
- `saveConfig` runs round-trip `JSON.parse` validation. On failure, auto-restores from backup
- Backups: max 3 per config file, oldest auto-deleted

### Platform
- WSL detection: checks `/proc/version` for "microsoft" (case-insensitive). `process.platform` returns `"linux"` even on WSL
- Linux audio priority: `pw-play` > `paplay` > `ffplay` > `mpv` > `aplay`
- WSL notification priority: `wsl-notify-send` > WinRT PowerShell Toast > terminal bell

### Sound Packs
- Resolution order: Project (`.dding-dong/packs/`) → User (`~/.config/dding-dong/packs/`) → Built-in (`sounds/`)
- Rotation: `"random"` = random pick from `files[]`. `"sequential"` or unset = always `files[0]` (no cycling)

### Cooldown
- Global (not per-event). Single `lastNotifiedAt` timestamp. A `session.start` within 3s of `task.complete` is suppressed

### Events
- `task.error`: defined in config/messages but has no triggering hook. Only testable via CLI test mode. Reserved for future Claude Code error hook support

### Website
- **pnpm only**: `website/` uses pnpm. Do NOT use `npm install` or `yarn` — breaks `pnpm-lock.yaml`
- **Tailwind v4 — no config file**: `tailwind.config.js` does not exist. Theme is defined in `src/styles/global.css` via `@theme` block
- **Sound copy dependency**: `pnpm dev`/`build` runs `copy-sounds.mjs` which requires `../sounds/` to exist. `public/sounds/` is gitignored and ephemeral
- **Base URL `/dding-dong/`**: For GitHub Pages. All internal links must use `localePath()` or `import.meta.env.BASE_URL`. Missing base URL → works locally, 404 on deploy
- **Korean color names**: Theme variables in `global.css` use Korean names (hanji, meok, onggi, etc.). This is intentional — do not rename to English
- **Tailwind v4 opacity**: 정수 프리셋 사용 (`text-hobak/7`), 소수 대괄호 금지 (`text-hobak/[0.07]`). `calc()`이나 커스텀 그리드 등 프리셋이 없는 경우만 arbitrary value 허용
- **i18n manual routing**: Pages at `pages/ko/index.astro` must be created manually. Astro i18n does not auto-generate locale pages

## SKILL.md Conventions

- Description format: `"<English description>. <Korean summary>. Use when the user says '<triggers>'."`
- `disable-model-invocation: true` → mechanical skill (run script + report result). Omit → needs model reasoning
- `context: fork` → only used by `dd-doctor`. For independent diagnostic analysis requiring a subagent

## Version Management

- `plugin.json` is the single source of truth. semver: `feat:` → minor, `fix:` → patch
- Commit order: feature/fix commit first → version bump as a separate `chore:` commit
- `node scripts/sync-version.mjs bump patch|minor|major`
- `node scripts/sync-version.mjs verify` (exits 1 on mismatch)

## Testing

No automated test suite exists yet. When adding tests:
- Test runner: `node:test` (maintains zero-dependency policy)
- Priority: `config.mjs` (5-stage merge), `platform.mjs` (detection), `notify.mjs` (dispatch flow)
- Hook tests: stop.mjs must always output `{}`, all hooks must exit(0) on error
- Sound pack tests: manifest validation, resolution order (project > user > built-in)
