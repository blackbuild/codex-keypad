---
name: simplicity-review
description: Review a bounded code, policy, skill, or documentation change for unnecessary complexity while preserving accepted requirements and invariants. Use for an explicit simplicity or over-engineering review and for Engineering Baseline's required simplicity pass on substantive policy, skill, and documentation work; other repositories adopt it only through their own local overlay.
license: MIT; see LICENSE.txt.
---

# Simplicity review

Challenge the implementation, not the accepted requirements. Read the bounded change, its current requirements, and the
affected flow before judging complexity. Identify the reviewed revision or working-tree diff.

Treat security, compatibility, concurrency, data integrity, public-wire behavior, authorization and ownership, safe
diagnostics, validation and meaningful testing, and fail-closed behavior as fixed invariants. A proposal that changes an
invariant, architecture, trust boundary, or maintainer-owned semantic contract is a decision stop, not cleanup.

For each mechanism, ask in order:

1. Does it serve a current concrete requirement?
2. Would direct code be clearer?
3. Does the repository, language, runtime, framework, or platform already provide the capability?
4. Does an already-installed dependency provide it without a new ownership burden?
5. Does the abstraction have a current second use, or only speculative flexibility?

Challenge one-use abstractions, duplicated platform capability, speculative extension points, parallel representations,
unneeded dependencies or configuration, and assurance ceremony without an independent confidence benefit. Do not replace
one abstraction with another merely to make the diff look cleaner.

Report only reviewable findings:

- `simplify:` location, complexity to remove, simpler replacement, affected invariants that remain satisfied, and the
  validation that would prove it.
- `keep:` challenged complexity, simpler candidate considered, and the concrete invariant that candidate cannot satisfy.
- `decision:` proposed invariant, architecture, security, or semantic change and the exact maintainer question; do not
  recommend it as ordinary remediation.

End with a disposition separating safe simplifications, justified complexity, and decision stops. A clean review may say
`Lean already. Ship.` after recording any important complexity that earned its place. Do not apply fixes during the review.

When this is an independent review axis, follow the exact-head, no-priming, and reconciliation rules in
[the Baseline simplicity-review policy](../../docs/agents/simplicity-reviews.md).

This is a scoped MIT-licensed adaptation of Dietrich Gebert's Ponytail and Ponytail Review guidance, not a vendored copy.
See [LICENSE.txt](LICENSE.txt) and the policy's provenance record.
