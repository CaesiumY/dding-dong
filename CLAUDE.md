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

# Register plugin with Claude Code
claude plugin add /path/to/dding-dong
```

## Architecture

### Directory Structure

```
hooks/                 # Claude Code hook entry points (.mjs)
  hooks.json           # Hook registration manifest
  _common.mjs          # Shared runHook() utility (stdin parse → notify → optional stdout)
  notification.mjs     # Notification hook → input.required
  stop.mjs             # Stop hook → task.complete (MUST respond with {})
  session-start.mjs    # SessionStart hook → session.start
  session-end.mjs      # SessionEnd hook → session.end
skills/                # Skill definitions (SKILL.md with YAML frontmatter)
  dd-config/
    SKILL.md           # /dding-dong:dd-config - settings management
    scripts/
      config-get.mjs   # Config key reader (JSON output)
      config-set.mjs   # Config key writer with validation
  dd-setup/
    SKILL.md           # /dding-dong:dd-setup - interactive setup wizard
    scripts/
      setup-meta.mjs   # Setup metadata reader/writer (_meta field)
  dd-sounds/
    SKILL.md           # /dding-dong:dd-sounds - sound pack management
  dd-test/
    SKILL.md           # /dding-dong:dd-test - notification testing
  dd-doctor/
    SKILL.md           # /dding-dong:dd-doctor - diagnostics (subagent, context: fork — no disable-model-invocation, needs model reasoning)
  dd-feedback/
    SKILL.md           # /dding-dong:dd-feedback - submit feedback as GitHub issue (NL auto-classification, no disable-model-invocation)
    scripts/
      collect-context.mjs  # Context collector for issue submission
  dd-help/
    SKILL.md           # /dding-dong:dd-help - plugin help with dynamic discovery (no disable-model-invocation, needs model reasoning)
    scripts/
      gather-info.mjs  # Skill/plugin info gatherer for help display
  dd-pack-create/
    SKILL.md           # /dding-dong:dd-pack-create - custom sound pack creation wizard (no disable-model-invocation, uses scripts/pack-wizard.mjs)
    references/
      manifest-spec.md # Sound pack manifest schema, directory structure, WAV spec
  dd-tts-pack/
    SKILL.md           # /dding-dong:dd-tts-pack - TTS sound pack creation via Qwen3-TTS (voice cloning + CustomVoice, no disable-model-invocation)
    scripts/
      check-env.mjs       # Environment checker (Python, qwen-tts, GPU)
      validate-ref-audio.mjs # Reference audio file validator
      ref-text.mjs         # Reference text template create/read (deterministic comment stripping)
      generate-tts.py      # TTS generation + postprocessing (Python, requires qwen-tts + CUDA GPU)
      setup-tts-venv.mjs   # TTS venv auto-installer (create venv + install packages)
scripts/
  notify.mjs           # Unified notification entry point
  generate-sounds.mjs  # Programmatic WAV generation (16-bit PCM, 44100Hz, mono)
  setup-wizard.mjs     # Environment detection + config validation tool (detect, validate)
  sync-version.mjs     # Version sync tool (sync, verify, bump) — source of truth: plugin.json
  check-config.mjs     # Config diagnostics collector (setup status, merged config, paths)
  config-save.mjs      # Config writer with scope routing (global/project/local)
  pack-wizard.mjs      # Sound pack management utility (discover, validate-name, check-exists, create, clone, validate-manifest, validate, apply)
  core/
    config.mjs         # Config/state load & save, backup & validation, default values
    platform.mjs       # Platform detection + audio player/notifier discovery
    player.mjs         # Cross-platform sound playback (detached + unref)
    notifier.mjs       # Cross-platform OS notification delivery
    messages.mjs       # Per-event messages (ko/en)
sounds/default/        # Built-in sound pack (WAV + manifest.json)
sounds/retro/          # 8-bit retro sound pack
sounds/musical/        # Piano chord sound pack
.dding-dong/packs/     # Project-level sound packs (에디터에서 보임)
.claude-plugin/        # Plugin metadata (plugin.json, marketplace.json)
```

### Data Flow

```
Hook event → hooks/*.mjs
  → _common.mjs runHook(eventType, options)
    → stdin parse (JSON event)
    → scripts/notify.mjs notify(eventType, context)
      → loadConfig(cwd)       (5-stage merge: Default ← Global ← Project ← Local ← env)
      → config.enabled check  (early return if disabled)
      → isQuietHours() check  (early return if in quiet hours)
      → loadState()
      → isCoolingDown() check (early return if within cooldown)
      → playSound() + sendNotification() in parallel (Promise.allSettled)
      → saveState()           (persist cooldown timestamp)
    → optional stdout response (e.g. stop hook → {})
```

### Config & State Files

Config is loaded via 5-stage merge (later stages override earlier):
1. **Default** — hardcoded `DEFAULT_CONFIG` in `config.mjs`
2. **Global** — `~/.config/dding-dong/config.json`
3. **Project** — `.dding-dong/config.json` (team-shared, committed)
4. **Project Local** — `.dding-dong/config.local.json` (personal override, gitignored)
5. **Env vars** — `DDING_DONG_ENABLED`, `DDING_DONG_VOLUME`, `DDING_DONG_LANG`, `DDING_DONG_PACK`

Other paths:
- State: `~/.config/dding-dong/.state.json` (global, no scope split)
- Project sound packs: `.dding-dong/packs/<pack-name>/manifest.json` (project-level, 에디터에서 보임)
- User sound packs: `~/.config/dding-dong/packs/<pack-name>/manifest.json`
- Backup files: `<config-path>.backup.<YYYYMMDD_HHMMSS>` (max 3, auto-rotated)

#### `_meta` field convention

The `_meta` field in the global config (`~/.config/dding-dong/config.json`) stores setup metadata:
```json
{ "_meta": { "setupCompleted": true, "setupVersion": "<from plugin.json>", "setupDate": "..." } }
```
- **Stored in**: Global config only (never in project/local configs)
- **Merge behavior**: Isolated from `deepMerge` in `loadConfig()` — extracted before merge, re-attached after
- **Usage**: `doctor` skill checks `_meta.setupCompleted` to detect first-time setup status

### Cross-Platform Strategy

`platform.mjs` detects platform → `player.mjs` / `notifier.mjs` branch per platform:

| Platform | Sound Playback | OS Notification |
|----------|---------------|-----------------|
| macOS | `afplay` | `osascript` |
| Linux | `pw-play` > `paplay` > `ffplay` > `mpv` > `aplay` | `notify-send` |
| WSL | PowerShell `MediaPlayer` | `wsl-notify-send` > WinRT Toast > terminal bell |

### Event Types

`task.complete`, `task.error`*, `input.required`, `session.start`, `session.end`

> *`task.error` is defined in config/messages but has no triggering hook in hooks.json. Only testable via CLI `test` mode. Reserved for future Claude Code error hook support.

## Critical Design Rules

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **Root cause fixes**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Stop hook MUST respond**: `stop.mjs` must write `{}` (empty JSON object) to stdout. Missing this halts Claude execution.
- **Always exit(0) on error**: Notification failure must never block Claude. All hook catch blocks call `process.exit(0)`.
- **detached + unref**: Audio processes use `spawn(..., { detached: true, stdio: 'ignore' }).unref()` to complete within the 5-second hook timeout.
- **ESM only**: All scripts use `.mjs` extension with `import`/`export` syntax.
- **No npm dependencies**: Only Node.js built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:os`, `node:url`).
- **Env var overrides**: `DDING_DONG_ENABLED`, `DDING_DONG_VOLUME`, `DDING_DONG_LANG`, `DDING_DONG_PACK` override config values.
- **Sound pack resolution order**: Project packs (`.dding-dong/packs/`) → User packs (`~/.config/dding-dong/packs/`) → built-in packs (`sounds/`).
- **SKILL.md description convention**: Format as `"<English description>. <한글 요약>. Use when the user says '<trigger1>', '<trigger2>'."` — dd-help dynamically extracts the Korean portion for display. Trigger phrases enable automatic skill matching.
- **Version management**: `plugin.json` is the single source of truth. Use `node scripts/sync-version.mjs bump <patch|minor|major>` to bump and auto-sync to `marketplace.json` (root version + plugins[0].version). Use `verify` subcommand to check consistency (exit 1 on mismatch). Follow semver: `feat:` → **minor**, `fix:` → **patch**. **When committing**: if the commit type is `feat:` or `fix:`, first run the appropriate bump command, then create the feature/fix commit first, followed by the version bump as a separate `chore:` commit. (기능 커밋 → 버전 범프 순서)

## Testing

No automated test suite exists yet. When adding tests:
- Test runner: `node:test` (maintains zero-dependency policy)
- Priority: `config.mjs` (5-stage merge), `platform.mjs` (detection), `notify.mjs` (dispatch flow)
- Hook tests: stop.mjs must always output `{}`, all hooks must exit(0) on error
- Sound pack tests: manifest validation, resolution order (user > built-in)
