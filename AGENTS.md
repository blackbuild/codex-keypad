# Codex Keypad Hive

The standing coordinator task for this project is **Codex Keypad Hive**. In this
project's coordination vocabulary, a Hive is the standing coordinator task; the
project remains the project. Hive and worker terminology is local engineering
language, not a product concept that adopters must use.

## Scope and authority

The repository is authoritative for product source, tests, accepted architecture,
public contracts, and user/developer documentation. A parallel project-memory
workspace may hold operational plans, indexes, coordination state, evidence, and
lessons, but repository truth and explicit maintainer decisions take precedence.

Do not make builds, tests, runtime behavior, or product adoption depend on the
parallel `agent/` project-memory directory. A filesystem handoff located there may
be used by this project while dogfooding, but it is one configurable transport,
not part of the product contract.

Keep these boundaries explicit:

- Codex state sources own unstable Codex persistence and event details.
- The product core owns normalized project, task, activity, and attention state.
- Handoff transports move validated state and semantic actions.
- Device adapters own hardware-specific rendering and input handling.
- Agent-requested hardware changes pass through validation and policy; never pass
  arbitrary executable commands through a handoff transport.

## Validation

For code changes, run `npm test` and `npm run build` unless the work is confined
to documentation. Report any narrower validation explicitly.

## Agent skills

Project-local skills and their pinned sources are catalogued in
`.agents/skills/README.md`.

### Issue tracker

Issues and PRDs live as GitHub Issues in `blackbuild/codex-keypad`. Pull requests
are implementation and review artifacts, not an incoming request surface. See
`docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, and `wontfix` roles. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with `CONTEXT.md` at the root and accepted
architecture decisions under `docs/adr/`. See `docs/agents/domain.md`.

### Issue implementation commits

Implement issues on a new, dedicated issue branch using small, reasoned commits.
Agents may create commits there without asking. Review and, when useful, rewrite
the local commit sequence before publication. Once an external review system can
hold comments or findings against published commits, preserve those commits and
add fixes as follow-up commits. Direct maintainer-to-agent feedback does not start
that freeze: local history may still be rewritten and force-pushed when the
maintainer permits it. See `docs/agents/commits.md`.
