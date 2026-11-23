# Upstream provenance

- Source: https://github.com/xyflow/xyflow
- Fork: https://github.com/chadcoulter/100monkeys-cloud-flow-widget
- Base commit inspected: `bb63f4cc345acf4e6c73e0371be3ea3ca01b2a18`
- Base branch: `main`; implementation branch: `feature/cloud-flow`.
- React Flow package: `@xyflow/react` 12.12.0.
- Shared graph system: `@xyflow/system` 0.0.83.
- Workspace: pnpm 10.33.4, Turborepo, packages under `packages/*`, demos under `examples/*`.
- License: MIT. The original root `LICENSE` and upstream package notices are retained unchanged.
- Original root README: preserved verbatim as `readme_orig`.

## Fork changes

The root README is the supplied 100 Monkeys implementation brief, with a quick start added. `packages/cloud-flow` adds graph validation/indexing, breadcrumb navigation, nested stacks, deterministic layout, React orchestration, and UI. `examples/cloud-flow` adds a runnable capability explorer, sourced sample JSON, and Playwright scenarios. No React Flow or Svelte Flow internals are rewritten.

The default demo now uses the `wiki-stacks` format: full page text and wiki links become information cards, and explicit JSON stack records determine ordering and recursive horizontal/vertical grouping. The underlying navigation still preserves shared identities and route-specific visits.

## Updating upstream

Add the upstream remote with `git remote add upstream https://github.com/xyflow/xyflow.git` if it is absent. Fetch upstream, inspect its changes, and merge the chosen upstream revision into a dedicated update branch. Resolve workspace/lockfile conflicts while preserving the Cloud Flow package, demo, README, original README, and license notices. Run `pnpm build:cloud`, `pnpm check:cloud`, and `pnpm test:cloud`, along with applicable upstream checks. Record the newly adopted upstream commit here after verification. Upstream updates are deliberate, not automatic dependency replacement.

## Capability sources

Sample records are paraphrases of the supplied October and August 2026 capability documents. Full source documents are not redistributed in this public fork. `examples/cloud-flow/src/sample.json` identifies document sections/items per record. Proposed cross-links demonstrate navigation and are not verified implementation claims. Earlier architectural documents listed in the brief were not needed to infer additional technical dependencies.
