# dding-dong 띵동 🔔

**English** | [한국어](README.ko.md)

[![GitHub stars](https://img.shields.io/github/stars/CaesiumY/dding-dong?style=flat&color=yellow)](https://github.com/CaesiumY/dding-dong/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **[Visit the website](https://caesiumy.github.io/dding-dong/)** — Listen to sound packs and explore features.

> Claude Code notification plugin — Alerts you with sounds and OS notifications on task completion, errors, and input requests. Create custom notification sounds with AI voice synthesis.

**dding-dong (띵동)** is a Korean onomatopoeia for a doorbell chime. It notifies you when Claude Code finishes a task or needs your attention.

## Features

- Instant alerts on task completion, errors, and input requests
- Cross-platform support: macOS, Linux, WSL (Windows)
- Customizable notification sounds with the sound pack system
- **AI voice synthesis** — Generate your own voice notifications with Qwen3-TTS (voice cloning & emotion control)
- Korean/English message support
- Quiet hours, cooldown, and environment variable overrides

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## Quick Start

### Step 1. Install

Run the following command in Claude Code:

```
/plugin marketplace add https://github.com/CaesiumY/dding-dong
/plugin install dding-dong
```

### Step 2. Setup

```
/dding-dong:dd-setup
```

Automatically detects your platform and checks for audio players and notification tools.

### Step 3. Test

```
/dding-dong:dd-test
```

Cycles through all event types to test notifications. If you hear sounds, you're all set!

<details>
<summary>Alternative installation / Update</summary>

#### Direct install

```bash
claude plugin add https://github.com/CaesiumY/dding-dong
```

#### Local install (development/testing)

```bash
git clone https://github.com/CaesiumY/dding-dong
cd dding-dong
claude plugin add .
```

#### Update

```
/plugin marketplace update dding-dong
```

</details>

## Skills

### Basic Skills

| Skill                         | Description                    |
| ----------------------------- | ------------------------------ |
| `/dding-dong:dd-setup`        | Environment detection & setup  |
| `/dding-dong:dd-test`         | Test all event notifications   |
| `/dding-dong:dd-config`       | View/modify settings           |
| `/dding-dong:dd-sounds`       | Manage sound packs             |
| `/dding-dong:dd-doctor`       | Auto-diagnose notification issues |

### Advanced Skills

| Skill                         | Description                         |
| ----------------------------- | ----------------------------------- |
| `/dding-dong:dd-feedback`     | Auto-generate feedback/bug reports  |
| `/dding-dong:dd-help`         | Help and feature guide              |
| `/dding-dong:dd-pack-create`  | Custom sound pack creation wizard   |
| `/dding-dong:dd-tts-pack`     | TTS voice synthesis sound pack      |

## Configuration

Configuration is merged in 5 stages (later stages take priority):

| Stage   | Path                               | Description                            |
| ------- | ---------------------------------- | -------------------------------------- |
| Default | *(built-in defaults)*              | Plugin hardcoded values                |
| Global  | `~/.config/dding-dong/config.json` | Global settings                        |
| Project | `.dding-dong/config.json`          | Shared per project (committed to repo) |
| Local   | `.dding-dong/config.local.json`    | Personal override (`.gitignore` recommended) |
| Env     | Environment variables              | Final override                         |

### Environment Variables

| Variable                   | Description              |
| -------------------------- | ------------------------ |
| `DDING_DONG_ENABLED=false` | Disable the plugin       |
| `DDING_DONG_VOLUME=0.5`    | Override volume           |
| `DDING_DONG_LANG=en`       | Override language          |
| `DDING_DONG_PACK=retro`    | Override sound pack        |

<details>
<summary>Full configuration example & option details</summary>

```json
{
  "enabled": true,
  "language": "ko",
  "sound": {
    "enabled": true,
    "pack": "default",
    "volume": 0.7,
    "events": {
      "task.complete": true,
      "task.error": true,
      "input.required": true,
      "session.start": false,
      "session.end": false
    }
  },
  "notification": {
    "enabled": true,
    "events": {
      "task.complete": true,
      "task.error": true,
      "input.required": true,
      "session.start": false,
      "session.end": false
    }
  },
  "messages": {
    "task.complete": "작업이 완료되었습니다!",
    "task.error": "오류가 발생했습니다",
    "input.required": "확인이 필요합니다",
    "session.start": "코딩을 시작합니다",
    "session.end": "세션이 종료되었습니다"
  },
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  },
  "cooldown_seconds": 3
}
```

#### Configuration Options

| Option                 | Default           | Description                                              |
| ---------------------- | ----------------- | -------------------------------------------------------- |
| `enabled`              | `true`            | Enable/disable the entire plugin                         |
| `language`             | `"ko"`            | Message language (`ko` / `en`)                           |
| `sound.enabled`        | `true`            | Enable sound notifications                               |
| `sound.pack`           | `"default"`       | Sound pack name to use                                   |
| `sound.volume`         | `0.7`             | Volume (0.0 – 1.0)                                       |
| `notification.enabled` | `true`            | Enable OS notifications                                  |
| `messages.<event>`     | *(language default)* | Custom message per event (overrides language default)  |
| `quiet_hours.enabled`  | `false`           | Enable quiet hours                                       |
| `quiet_hours.start`    | `"22:00"`         | Quiet hours start time                                   |
| `quiet_hours.end`      | `"08:00"`         | Quiet hours end time                                     |
| `cooldown_seconds`     | `3`               | Minimum interval between notifications (seconds)         |

</details>

## Cross-Platform Support

### macOS
- Sound: `afplay`
- Notification: `osascript` (native Notification Center)

### Linux
- Sound: `pw-play` → `paplay` → `ffplay` → `mpv` → `aplay` (searched in order)
- Notification: `notify-send` (libnotify)

### WSL (Windows Subsystem for Linux)
- Sound: PowerShell `System.Windows.Media.MediaPlayer`
- Notification: `wsl-notify-send` (if installed) → WinRT PowerShell Toast → terminal bell

## Sound Pack System

Sound packs are resolved from three locations in order:

1. **Project packs**: `.dding-dong/packs/<pack-name>/`
2. **User packs**: `~/.config/dding-dong/packs/<pack-name>/`
3. **Built-in packs**: `{plugin install path}/sounds/<pack-name>/`

### Built-in Sound Packs

| Pack      | Description                          |
| --------- | ------------------------------------ |
| `default` | Standard notification sounds         |
| `retro`   | 8-bit chiptune arcade-style effects  |
| `musical` | Piano chord-based harmonic alerts    |

### TTS Sound Pack Creation

Create voice-synthesized sound packs using Qwen3-TTS:

```
/dding-dong:dd-tts-pack
```

| Mode           | Description |
|----------------|-------------|
| Voice Cloning  | Clone your own voice from a reference audio sample (3+ seconds required) |
| CustomVoice    | Choose from 9 built-in speakers. Control emotion/style with natural language (e.g., "bright and energetic tone") |

**Requirements:** NVIDIA GPU (CUDA) · Python 3.10+ (automatic venv setup supported)

<details>
<summary>TTS pack creation flow</summary>

1. Automatic environment check (GPU, Python, qwen-tts)
2. Mode selection → model size selection (0.6B / 1.7B)
3. Pack name/info input → boilerplate generation
4. Voice configuration (reference audio or speaker selection)
5. Per-event text & emotion settings
6. Preview → full generation → validation → apply

</details>

<details>
<summary>manifest.json structure & how to apply a sound pack</summary>

#### manifest.json structure

```json
{
  "name": "my-pack",
  "displayName": "My Custom Sound Pack",
  "version": "1.0.0",
  "author": "Author",
  "description": "Sound pack description",
  "events": {
    "task.complete": {
      "files": ["complete1.wav", "complete2.wav"],
      "rotation": "random"
    },
    "task.error": {
      "files": ["error.wav"]
    }
  }
}
```

| Field         | Required | Description                              |
| ------------- | -------- | ---------------------------------------- |
| `name`        | Yes      | Pack identifier (must match directory name) |
| `displayName` | No       | Human-readable display name              |
| `version`     | No       | Semantic version                         |
| `author`      | No       | Pack author                              |
| `description` | No       | Pack description                         |
| `events`      | Yes      | Event-to-sound mapping                   |

#### Rotation Modes

| Mode                     | Behavior                            |
| ------------------------ | ----------------------------------- |
| `"random"`               | Random selection from `files` array |
| Other or not specified   | Play first file                     |

#### Applying a Sound Pack

Specify the pack name in your config file:

```json
{
  "sound": {
    "pack": "my-pack"
  }
}
```

</details>

## Troubleshooting

If sounds aren't playing or notifications aren't showing:

```
/dding-dong:dd-doctor
```

Automatically inspects your environment and provides diagnosis with suggested fixes.

## Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

MIT License — See the [LICENSE](LICENSE) file for details.
