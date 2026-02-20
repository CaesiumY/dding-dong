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
  notification.mjs     # Notification hook → input.required
  stop.mjs             # Stop hook → task.complete (MUST respond with decision)
  session-start.mjs    # SessionStart hook → session.start
  session-end.mjs      # SessionEnd hook → session.end
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
commands/              # Slash command definitions (.md)
.claude-plugin/        # Plugin metadata (plugin.json, marketplace.json)
```

### Data Flow

```
Hook event → hooks/*.mjs → scripts/notify.mjs
  → loadConfig()
  → isQuietHours() check (early return if in quiet hours)
  → isCoolingDown() check (early return if within cooldown)
  → playSound() + sendNotification() in parallel (Promise.allSettled)
  → saveState() (persist cooldown timestamp)
```

### Config & State Files

- Config: `~/.config/dding-dong/config.json`
- State: `~/.config/dding-dong/.state.json`
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

- **Stop hook MUST respond**: `stop.mjs` must write `{}` to stdout. Missing this halts Claude execution.
- **Always exit(0) on error**: Notification failure must never block Claude. All hook catch blocks call `process.exit(0)`.
- **detached + unref**: Audio processes use `spawn(..., { detached: true, stdio: 'ignore' }).unref()` to complete within the 5-second hook timeout.
- **ESM only**: All scripts use `.mjs` extension with `import`/`export` syntax.
- **No npm dependencies**: Only Node.js built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:os`, `node:url`).
- **Env var overrides**: `DDING_DONG_ENABLED`, `DDING_DONG_VOLUME`, `DDING_DONG_LANG` override config values.
- **Sound pack resolution order**: User packs (`~/.config/dding-dong/packs/`) → built-in packs (`sounds/`).
