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
  stop.mjs             # Stop hook → task.complete (MUST respond with decision)
  session-start.mjs    # SessionStart hook → session.start
  session-end.mjs      # SessionEnd hook → session.end
skills/                # Skill definitions (SKILL.md with YAML frontmatter)
  config/
    SKILL.md           # /dding-dong:config - 설정 변경
  setup/
    SKILL.md           # /dding-dong:setup - 환경 설정
  sounds/
    SKILL.md           # /dding-dong:sounds - 사운드팩 관리
  test/
    SKILL.md           # /dding-dong:test - 알림 테스트
  diagnose/
    SKILL.md           # /dding-dong:diagnose - 문제 진단 (서브에이전트)
scripts/
  notify.mjs           # Unified notification entry point
  generate-sounds.mjs  # Programmatic WAV generation (16-bit PCM, 44100Hz, mono)
  setup-wizard.mjs     # Environment detection tool
  core/
    config.mjs         # Config/state load & save, default values
    platform.mjs       # Platform detection + audio player/notifier discovery
    player.mjs         # Cross-platform sound playback (detached + unref)
    notifier.mjs       # Cross-platform OS notification delivery
    messages.mjs       # Per-event messages (ko/en)
sounds/default/        # Built-in sound pack (WAV + manifest.json)
sounds/retro/          # 8-bit retro sound pack
sounds/musical/        # Piano chord sound pack
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
    → optional stdout response (e.g. stop hook → { decision: 'continue' })
```

### Config & State Files

Config is loaded via 5-stage merge (later stages override earlier):
1. **Default** — hardcoded `DEFAULT_CONFIG` in `config.mjs`
2. **Global** — `~/.config/dding-dong/config.json`
3. **Project** — `.dding-dong/config.json` (team-shared, committed)
4. **Project Local** — `.dding-dong/config.local.json` (personal override, gitignored)
5. **Env vars** — `DDING_DONG_ENABLED`, `DDING_DONG_VOLUME`, `DDING_DONG_LANG`

Other paths:
- State: `~/.config/dding-dong/.state.json` (global, no scope split)
- User sound packs: `~/.config/dding-dong/packs/<pack-name>/manifest.json`

### Cross-Platform Strategy

`platform.mjs` detects platform → `player.mjs` / `notifier.mjs` branch per platform:

| Platform | Sound Playback | OS Notification |
|----------|---------------|-----------------|
| macOS | `afplay` | `osascript` |
| Linux | `pw-play` > `paplay` > `ffplay` > `mpv` > `aplay` | `notify-send` |
| WSL | PowerShell `MediaPlayer` | `wsl-notify-send` > WinRT Toast > terminal bell |

### Event Types

`task.complete`, `task.error`, `input.required`, `session.start`, `session.end`

## Critical Design Rules

- **Stop hook MUST respond**: `stop.mjs` must write `{ "decision": "continue" }` to stdout. Missing this halts Claude execution.
- **Always exit(0) on error**: Notification failure must never block Claude. All hook catch blocks call `process.exit(0)`.
- **detached + unref**: Audio processes use `spawn(..., { detached: true, stdio: 'ignore' }).unref()` to complete within the 5-second hook timeout.
- **ESM only**: All scripts use `.mjs` extension with `import`/`export` syntax.
- **No npm dependencies**: Only Node.js built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:os`, `node:url`).
- **Env var overrides**: `DDING_DONG_ENABLED`, `DDING_DONG_VOLUME`, `DDING_DONG_LANG` override config values.
- **Sound pack resolution order**: User packs (`~/.config/dding-dong/packs/`) → built-in packs (`sounds/`).
