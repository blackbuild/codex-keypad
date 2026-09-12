# Architecture

Codex Keypad is a programmable hardware control surface for observing and acting
on Codex work. The initial device adapter targets Logitech MX Keypad on macOS, but
the product core must not depend on one device, one handoff transport, or a
particular local workspace layout.

## Product boundaries

- The product does not require the `repo/` and `agent/` split-directory layout.
- A handoff directory inside project memory is one dogfood configuration, not an
  adoption prerequisite.
- Codex persistence parsing stays isolated from Logitech UI and action code.
- Device adapters consume validated normalized state, not raw agent output.
- Hardware input produces semantic actions rather than arbitrary commands.
- Persistent public configuration belongs to the repository or conventional
  application configuration. Ephemeral coordination and observations may live in
  a configured handoff transport.

## Current tracer bullet

The TypeScript Logitech plugin reads active Codex Desktop tasks through an
isolated Codex adapter, assigns a startup snapshot to nine stable LCD-key actions,
and opens a selected task through `codex://threads/<thread-id>`. Live image and
label updates require either a richer device adapter or future Node SDK support.
