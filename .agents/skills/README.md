# Project skill catalog

Project-local skills are pinned imports. Their presence supplies workflow
guidance; it does not grant authority to mutate repositories, trackers, pull
requests, credentials, devices, or external systems.

## Engineering Baseline imports

Source: `blackbuild/engineering-baseline` at
`cc309349afb5128f80b5aa93d90ae11517116827`.

| Skill | Purpose |
| --- | --- |
| `work-orchestrator` | Coordinate evidence-backed work packages |
| `codebase-design` | Design deep, testable modules and seams |
| `research` | Collect cited primary-source findings |
| `writing-great-skills` | Create compact, predictable skills |
| `simplicity-review` | Challenge unnecessary complexity |

These are the current Engineering Baseline adaptations and are authoritative for
their covered workflow within this repository unless a repository-local rule says
otherwise.

## Provisional general engineering imports

Source: `klum-dsl/klum-ast` at
`ad30641659c5037c72d0dfe083fbfebecc9899e0`. That source records their upstream
origin as `mattpocock/skills`.

| Skill | Purpose |
| --- | --- |
| `setup-matt-pocock-skills` | Bootstrap tracker and domain conventions |
| `tdd` | Test-first vertical implementation loops |
| `code-review` | Separate standards and specification review |
| `diagnosing-bugs` | Build a tight reproduction loop before diagnosis |
| `domain-modeling` | Maintain precise domain vocabulary and ADRs |
| `grilling` | Resolve design decisions one question at a time |
| `grill-with-docs` | Combine grilling with domain documentation |
| `prototype` | Build disposable experiments that answer one question |
| `to-prd` | Synthesize a conversation into a product requirement issue |
| `to-issues` | Split a plan into tracer-bullet issues |
| `triage` | Move issues through the configured triage states |
| `improve-codebase-architecture` | Find and explore module-deepening opportunities |

These remain provisional because Engineering Baseline has not yet published
adapted versions. Prefer replacing them with pinned Baseline variants when those
become available, after comparing local behavior and preserving deliberate
repository overlays.

The local `setup-matt-pocock-skills` copy clarifies that commit preservation
starts with external review systems; direct maintainer-to-agent feedback does not
freeze unpublished history. This deliberate overlay must survive a source refresh
unless Engineering Baseline adopts the same rule.

## Deliberate exclusions

- `qa` and `request-refactor-plan` are marked deprecated by the pinned source.
- Claude-specific, personal, and in-progress skills are outside this project's
  portable workflow.
- `implement` is deferred until the repository selects the coding-style and
  pull-request policies it assumes.
