# @100monkeys/cloud-flow

A React/TypeScript capability-graph explorer built on React Flow. Recursive breadcrumb stacks preserve the route to a focus and all onward explorations from that visit. Shared capabilities retain one domain identity across visits.

This package is currently provided in the [100 Monkeys repository](https://github.com/chadcoulter/100monkeys-cloud-flow-widget); it has not been published to npm.

```tsx
import { CloudFlow, type CloudFlowDocument } from '@100monkeys/cloud-flow';
import '@xyflow/react/dist/style.css';
import '@100monkeys/cloud-flow/style.css';

export function CapabilityExplorer({ document }: { document: CloudFlowDocument }) {
  return <div style={{ height: '100vh' }}><CloudFlow document={document} /></div>;
}
```

React and React DOM 18+ are peer dependencies. A containing element must provide height. The component supports controlled `viewState` / `onViewStateChange`, uncontrolled `initialViewState`, `initialFocusNodeId`, `onFocusChange`, and `reducedMotion`.

Pure exports include document parsing/indexing, breadcrumb navigation, stack operations, session serialization/restoration, and deterministic layout. See `docs/cloud-flow.md` in the repository for the full API and JSON format.

MIT licensed. Upstream React Flow notices are preserved in the repository and package license.
