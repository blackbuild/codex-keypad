---
name: work-orchestrator
description: Maintain an evidence-backed, user-selectable engineering-baseline horizon without confusing policy work, local execution, and external delivery.
source: Adapted from KlumAST work-orchestrator at ad30641659c5037c72d0dfe083fbfebecc9899e0.
---

# Work orchestrator

Use for the Engineering Baseline Hive's bounded policy or coordination horizon. Root `AGENTS.md` is authoritative.

1. Refresh the relevant baseline repository, owning-repository tracker/PR/release records, and task reports without mutation. Prefer primary evidence and record a revision, timestamp, or durable link.
2. Present only genuinely actionable, bounded choices. For each, distinguish execution state, delivery state, and external condition; name dependencies and owner boundaries.
3. Treat product code, repository-local workflows, credentials, releases, environments, and registry operations as adapters owned by that repository. Shared Gradle convention-plugin implementation belongs in `gradle-conventions`; this baseline owns only portable process contracts. A baseline issue must state scope, non-goals, dependencies, and affected adapters.
4. The root Hive alone admits user-visible work packages and owns the horizon/capacity record; it must not use hidden subagents as substitutes for those packages. An admitted worker cannot dispatch another user-visible task, but may use bounded internal subagents within its accepted scope when that materially improves independent research, implementation, or review. Each has a declared purpose and remains within the worker's repository scope, remote authority, decision rights, and stopping condition. The worker retains integration, source verification, validation, and final-report ownership, and reports material subagent results. Internal subagents are not additional Hive admissions or capacity entries, but remain subject to task and platform limits.
5. A worker reports `RUNNING`, `COMPLETED`, or `NOT READY` using the root format. Completion requires a reconciliation request, not self-archiving; it must separate its bounded result from outstanding delivery or human conditions.
6. Before remote delivery, obtain explicit human authority and verify the exact target and channel. Do not treat GitHub App, `gh`, protected environment, signing, registry, or Pages authority as transferable. Record only safe outcome categories, never secrets or raw logs.

This skill coordinates recommendations and evidence. It does not authorize cross-repository change, direct rollout, release execution, or credential handling.
