# LeeWay Pocket Agent — Android Alpha

Phone-only Android shell for Agent Lee. No PC/server is required at runtime.

## Alpha capabilities
- Android local/offline-preferred speech recognition
- Android local text-to-speech
- Agent Lee Pocket identity
- Calendar event handoff
- Phone dialer handoff
- Online research handoff when internet is available
- Explicit offline/online behavior

## BitNet gate
The BitNet b1.58 local inference slot is intentionally not marked verified in this alpha. It must only be enabled after the selected Android ARM runtime + model checkpoint passes deterministic output tests on target Samsung hardware. The app architecture keeps the inference engine replaceable so the phone shell does not depend on a broken model build.

## Build
GitHub Actions builds `app-debug.apk` and uploads it as `LeeWay-Pocket-Agent-Alpha-APK`.
