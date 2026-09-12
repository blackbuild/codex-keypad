---
name: codebase-design
description: Design deep, testable modules and clean seams for reusable baseline process and automation contracts.
source: Adapted from KlumAST codebase-design at ad30641659c5037c72d0dfe083fbfebecc9899e0.
---

# Codebase design

Use this vocabulary for reusable baseline process and automation-contract design.

- A **module** has one **interface**: every fact a consumer must know, including invariants, configuration, error modes, and performance characteristics.
- A **seam** is where that interface lives; an **adapter** fills a seam when a real variation exists.
- **Depth** is leverage at the interface: hide substantial build behavior behind a small, stable consumer surface. Depth creates consumer leverage and maintainer locality.

For a candidate contract:

1. Name the repeated consumer behavior and the proposed contract interface. Keep repository-specific release, credential, workflow, and plugin implementation policy outside that interface.
2. Apply the deletion test: if removing the candidate spreads complexity across consumers, it may earn extraction; otherwise keep it local.
3. Introduce an adapter only for demonstrated variation, normally production plus a test adapter. Do not create a seam merely for hypothetical reuse.
4. Test observable behavior through the contract interface with representative consumer compatibility evidence. Build-specific validation belongs in `gradle-conventions`.
5. Record rejected alternatives and migration boundaries in the owning issue or ADR.

The baseline owns extraction criteria and portable process contracts; `gradle-conventions` owns shared plugin implementation, while each consumer owns adoption and local adapters.
