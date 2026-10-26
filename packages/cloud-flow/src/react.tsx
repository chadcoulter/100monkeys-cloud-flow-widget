import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import { indexGraph, nodeTypes, relationshipLabels, type CloudFlowDocument, type WikiDocument } from './domain.js';
import { WikiStacks } from './wiki-react.js';
import {
  back,
  boltStack,
  breadcrumbPath,
  createView,
  focusBreadcrumb,
  focusStack,
  restoreView,
  searchFocus,
  serializeView,
  toggleStack,
  traverse,
  type Breadcrumb,
  type CloudFlowViewState,
} from './navigation.js';
import { layoutCloud, type CardData, type CloudCanvasNode } from './layout.js';

type Commands = {
  choose: (data: CardData) => void;
  toggle: (id: string) => void;
  stackFocus: (id: string) => void;
  bolt: (id: string | null) => void;
};
const CommandContext = createContext<Commands | null>(null);
function CanvasCard({ data }: NodeProps<CloudCanvasNode>) {
  const actions = useContext(CommandContext)!;
  if (data.kind === 'stack')
    return (
      <div
        className={`cf-stack ${data.focused ? 'cf-selected' : ''} ${data.bolted ? 'cf-bolted' : ''}`}
        style={{ width: data.width, height: data.height }}
      >
        <div className="cf-stack-heading nodrag nopan">
          <button
            aria-label={`${data.expanded ? 'Collapse' : 'Expand'} ${data.label}`}
            aria-expanded={data.expanded}
            onClick={() => actions.toggle(data.stackId!)}
          >
            {data.expanded ? '−' : '+'}
          </button>
          <div>
            <strong>{data.label}</strong>
            <small>{data.subtitle}</small>
          </div>
          <button
            title="Focus this stack"
            aria-label={`Focus stack ${data.label}`}
            onClick={() => actions.stackFocus(data.stackId!)}
          >
            ◎
          </button>
          <button
            title="Bolt a nested exploration"
            aria-label={`Bolt onto ${data.label}`}
            onClick={() => actions.bolt(data.stackId!)}
          >
            ↗
          </button>
        </div>
      </div>
    );
  return (
    <div className={`cf-card ${data.focused ? 'cf-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="cf-card-eyebrow">{data.subtitle ?? data.domainNode?.type}</div>
      <button
        className="cf-card-title nodrag nopan"
        onClick={() => actions.choose(data)}
        aria-label={`Focus ${data.label}${data.breadcrumbId ? ` at ${data.breadcrumbId}` : ''}`}
      >
        {data.label}
      </button>
      <small>{data.domainNode?.id}</small>
      {data.edgeId && (
        <span className="cf-card-edge">{data.reverse ? '← reverse traversal' : '→ follow relationship'}</span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeRenderers = { cloudCard: CanvasCard };

export type CloudFlowProps = {
  document: CloudFlowDocument | WikiDocument;
  initialFocusNodeId?: string;
  initialViewState?: CloudFlowViewState;
  viewState?: CloudFlowViewState;
  onViewStateChange?: (state: CloudFlowViewState) => void;
  onFocusChange?: (nodeId: string, breadcrumb: Breadcrumb) => void;
  reducedMotion?: boolean;
  className?: string;
  children?: ReactNode;
};
export function CloudFlow(props: CloudFlowProps) {
  const graph = useMemo(() => indexGraph(props.document), [props.document]);
  if (graph.document.presentation?.kind === 'wiki') return <WikiStacks {...props} document={graph.document} />;
  return (
    <ReactFlowProvider>
      <Explorer key={JSON.stringify(graph.document)} {...props} graph={graph} />
    </ReactFlowProvider>
  );
}
function Explorer({ graph, ...props }: CloudFlowProps & { graph: ReturnType<typeof indexGraph> }) {
  const [local, setLocal] = useState(() =>
    props.initialViewState
      ? restoreView(graph, props.initialViewState)
      : createView(graph, props.initialFocusNodeId ?? graph.document.nodes[0].id)
  );
  const controlled = useMemo(
    () => (props.viewState ? restoreView(graph, props.viewState) : null),
    [graph, props.viewState]
  );
  const state = controlled ?? local;
  const [query, setQuery] = useState('');
  const [nodeType, setNodeType] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [depth, setDepth] = useState(3);
  const [members, setMembers] = useState(8);
  const [motion, setMotion] = useState(
    () =>
      props.reducedMotion ??
      (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
  const [message, setMessage] = useState('Explore a relationship to begin a breadcrumb stack.');
  const [sessionText, setSessionText] = useState('');
  const [recenter, setRecenter] = useState(0);
  const { setCenter, fitView } = useReactFlow<CloudCanvasNode>();
  const focusedNode = graph.nodes.get(state.focusNodeId)!;
  const breadcrumb = state.breadcrumbs[state.breadcrumbHeadId];
  const path = breadcrumbPath(state);
  const layout = useMemo(
    () => layoutCloud(graph, state, { maxDepth: depth, maxMembers: members, nodeType, relationshipType }),
    [graph, state, depth, members, nodeType, relationshipType]
  );
  function commit(next: CloudFlowViewState, description: string) {
    if (!props.viewState) setLocal(next);
    props.onViewStateChange?.(next);
    setMessage(description);
  }
  function safely(action: () => void) {
    try {
      action();
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const commands: Commands = {
    choose(data) {
      if (data.breadcrumbId)
        commit(focusBreadcrumb(state, data.breadcrumbId), `Returned to ${data.label}; explored branches restored.`);
      else if (data.edgeId)
        commit(traverse(graph, state, data.edgeId, data.reverse), `Focused ${data.label}. Arrival path retained.`);
      else if (data.domainNode) commit(searchFocus(graph, state, data.domainNode.id), `Search jump to ${data.label}.`);
    },
    toggle(id) {
      commit(toggleStack(state, id), 'Stack expansion saved.');
    },
    stackFocus(id) {
      commit(focusStack(state, id), `Focused stack ${state.stacks[id].label}.`);
    },
    bolt(id) {
      commit(boltStack(state, id), 'Exploration stack bolted. Domain graph preserved.');
    },
  };
  const notified = useRef('');
  useEffect(() => {
    if (notified.current !== breadcrumb.id) {
      notified.current = breadcrumb.id;
      props.onFocusChange?.(state.focusNodeId, breadcrumb);
    }
  }, [breadcrumb, state.focusNodeId, props.onFocusChange]);
  useEffect(() => {
    if (props.reducedMotion !== undefined) {
      setMotion(props.reducedMotion);
      return;
    }
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setMotion(preference.matches);
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, [props.reducedMotion]);
  useEffect(() => {
    const selected = layout.nodes.find((n) => n.data.focused);
    const frame = requestAnimationFrame(() => {
      void setCenter(
        selected ? selected.position.x + selected.data.width / 2 : 125,
        selected ? selected.position.y + selected.data.height / 2 : 63,
        { zoom: 0.8, duration: motion ? 0 : 240 }
      );
    });
    return () => cancelAnimationFrame(frame);
    // Recenter only when the active context changes or the user requests it.
  }, [state.breadcrumbHeadId, state.activeStackId, recenter, motion, setCenter]);
  const roots = Object.values(state.stacks).filter((s) => s.anchorBreadcrumbId === breadcrumb.id && !s.parentStackId);
  const outgoing = graph.outgoing.get(state.focusNodeId)!;
  const incoming = graph.incoming.get(state.focusNodeId)!;
  const results = graph.document.nodes.filter(
    (n) =>
      (!nodeType || n.type === nodeType) &&
      `${n.label} ${n.description ?? ''} ${n.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
  function renderStack(id: string, level = 0): ReactNode {
    if (level > 8) return <p key={id}>Depth limit reached.</p>;
    const stack = state.stacks[id];
    return (
      <div className="cf-stack-control" key={id}>
        <div className="cf-stack-control-heading">
          <button aria-expanded={stack.expanded} onClick={() => commands.toggle(id)}>
            {stack.expanded ? '−' : '+'} {stack.label}
          </button>
          <button aria-label={`Center stack ${stack.label}`} onClick={() => commands.stackFocus(id)}>
            ◎
          </button>
          <button aria-label={`Nest exploration in ${stack.label}`} onClick={() => commands.bolt(id)}>
            ↗
          </button>
        </div>
        {stack.expanded && (
          <div className="cf-nested">
            {stack.members.slice(0, members).map((m, i) =>
              m.kind === 'stack' ? (
                renderStack(m.id, level + 1)
              ) : (
                <button
                  key={`${m.id}:${i}`}
                  className="cf-list-button"
                  onClick={() =>
                    commands.choose({
                      kind: 'card',
                      label: graph.nodes.get(m.id)!.label,
                      domainNode: graph.nodes.get(m.id),
                      edgeId: m.edgeId,
                      reverse: m.reverse,
                      width: 0,
                      height: 0,
                    })
                  }
                >
                  {graph.nodes.get(m.id)!.label}
                </button>
              )
            )}
            {stack.members.length > members && (
              <p>Increase “Cards per stack” to see {stack.members.length - members} more.</p>
            )}
          </div>
        )}
      </div>
    );
  }
  function renderHistory(id: string, level = 0): ReactNode {
    const b = state.breadcrumbs[id];
    if (level >= depth)
      return b.childBreadcrumbIds.length ? <small key={id}>Increase depth to reveal onward history.</small> : null;
    return b.childBreadcrumbIds.slice(0, members).map((childId) => {
      const child = state.breadcrumbs[childId];
      return (
        <li key={childId}>
          <button
            className="cf-list-button"
            onClick={() => commit(focusBreadcrumb(state, childId), 'Saved exploration restored.')}
          >
            {graph.nodes.get(child.currentNodeId)!.label}
            <small>
              {child.arrival === 'search' ? 'search jump' : child.reverse ? 'reverse traversal' : 'traversed'} ·{' '}
              {childId}
            </small>
          </button>
          <ul>{renderHistory(childId, level + 1)}</ul>
        </li>
      );
    });
  }
  return (
    <CommandContext.Provider value={commands}>
      <div
        className={`cf-explorer ${props.className ?? ''}`}
        onKeyDown={(event) => {
          if ((event.altKey && event.key === 'ArrowLeft') || (event.key === 'Escape' && state.activeStackId)) {
            event.preventDefault();
            commit(back(state), 'Returned to previous context.');
          }
        }}
      >
        <header className="cf-header">
          <div className="cf-brand">
            <span className="cf-brand-mark">100</span>
            <div>
              <strong>MONKEYS</strong>
              <small>Cloud Flow / Capability explorer</small>
            </div>
          </div>
          <div className="cf-session-chip">
            {Object.keys(state.breadcrumbs).length} visits ·{' '}
            {Object.values(state.stacks).filter((s) => s.bolted).length} explorations
          </div>
        </header>
        <div className="cf-toolbar" aria-label="Exploration controls">
          <button
            disabled={!breadcrumb.previousBreadcrumbId && !state.activeStackId}
            onClick={() => commit(back(state), 'Returned to previous context.')}
          >
            ← Back
          </button>
          <button onClick={() => commands.bolt(state.activeStackId)}>↗ Bolt exploration</button>
          <button onClick={() => setRecenter((n) => n + 1)}>◎ Fit to focus</button>
          <button
            onClick={() => {
              void fitView({ padding: 0.15, duration: motion ? 0 : 240 });
            }}
          >
            Fit all
          </button>
          <button
            onClick={() =>
              commit(createView(graph, props.initialFocusNodeId ?? graph.document.nodes[0].id), 'Exploration reset.')
            }
          >
            Reset exploration
          </button>
          <label className="cf-motion">
            <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} /> Reduce motion
          </label>
        </div>
        <nav className="cf-breadcrumbs" aria-label="Arrival breadcrumb stack">
          {path.map((b, i) => (
            <span key={b.id}>
              {i > 0 && <span aria-hidden="true"> › </span>}
              <button
                aria-current={b.id === breadcrumb.id ? 'location' : undefined}
                onClick={() => commit(focusBreadcrumb(state, b.id), 'Breadcrumb context restored.')}
              >
                {b.arrival === 'search' ? '⌕ ' : ''}
                {graph.nodes.get(b.currentNodeId)!.label}
              </button>
            </span>
          ))}
        </nav>
        <div className="cf-workspace">
          <aside className="cf-sidebar" aria-label="Explore capabilities">
            <div className="cf-section-label">DISCOVER THE CLOUD</div>
            <label>
              Search capabilities
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, identity, or description…"
              />
            </label>
            <div className="cf-filter-row">
              <label>
                Node type
                <select value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
                  <option value="">All types</option>
                  {nodeTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Relationship
                <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>
                  <option value="">All relationships</option>
                  {[...new Set(graph.document.edges.map((e) => e.type))].sort().map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {query && (
              <div className="cf-results">
                <small>{results.length} matches · searches retain an explicit jump in your history</small>
                {results.slice(0, 50).map((n) => (
                  <button
                    key={n.id}
                    className="cf-list-button"
                    onClick={() => commit(searchFocus(graph, state, n.id), `Search jump to ${n.label}.`)}
                  >
                    {n.label}
                    <small>
                      {n.type} · {n.id}
                    </small>
                  </button>
                ))}
                {!results.length && <p>No matching capabilities.</p>}
              </div>
            )}
            <h2>
              Relationships <span>{outgoing.length + incoming.length}</span>
            </h2>
            <div className="cf-relationships">
              {[
                ...outgoing.map((edge) => ({ edge, reverse: false })),
                ...incoming.map((edge) => ({ edge, reverse: true })),
              ]
                .filter(
                  ({ edge, reverse }) =>
                    (!relationshipType || edge.type === relationshipType) &&
                    (!nodeType || graph.nodes.get(reverse ? edge.source : edge.target)!.type === nodeType)
                )
                .map(({ edge, reverse }) => {
                  const other = graph.nodes.get(reverse ? edge.source : edge.target)!;
                  return (
                    <button
                      className="cf-list-button"
                      key={`${edge.id}:${reverse}`}
                      aria-label={`Traverse ${other.label} via ${reverse ? 'reverse ' : ''}${edge.type}`}
                      onClick={() => commit(traverse(graph, state, edge.id, reverse), `Focused ${other.label}.`)}
                    >
                      <small className="cf-relation-label">
                        {reverse ? '← ' : '→ '}
                        {relationshipLabels[edge.type]?.[reverse ? 1 : 0] ?? edge.type}{' '}
                        <em>{edge.status ?? 'unspecified'}</em>
                      </small>
                      {other.label}
                    </button>
                  );
                })}
            </div>
            <h2>Stacks</h2>
            {roots.map((s) => renderStack(s.id))}
            <div className="cf-filter-row">
              <label>
                Depth limit
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={depth}
                  onChange={(e) => setDepth(Math.min(8, Math.max(1, Number(e.target.value))))}
                />
              </label>
              <label>
                Cards per stack
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={members}
                  onChange={(e) => setMembers(Math.min(50, Math.max(1, Number(e.target.value))))}
                />
              </label>
            </div>
            <p className="cf-help">
              Tab to a card or control and press Enter. Alt + ← returns along the arrival stack. Pan by dragging the
              canvas; pinch to zoom.
            </p>
          </aside>
          <main className="cf-canvas" aria-label="Capability cloud canvas">
            <div className="cf-canvas-caption">
              <span className="cf-live-dot" />
              {state.activeStackId ? 'STACK FOCUS' : 'CURRENT FOCUS'}
              <strong>{state.activeStackId ? state.stacks[state.activeStackId].label : focusedNode.label}</strong>
            </div>
            <ReactFlow<CloudCanvasNode>
              nodes={layout.nodes}
              edges={layout.edges}
              nodeTypes={nodeRenderers}
              minZoom={0.08}
              maxZoom={1.8}
              nodesConnectable={false}
              nodesDraggable={false}
              edgesFocusable={false}
              deleteKeyCode={null}
              proOptions={{ hideAttribution: false }}
            >
              <Background color="#c7d7d5" gap={24} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
            <div className="cf-canvas-legend">
              <span>Arrival stack ←</span>
              <span>Relationships ↕</span>
              <span>→ Explored branches</span>
            </div>
          </main>
          <aside className="cf-inspector" aria-label="Node and edge details">
            <div className="cf-section-label">POINT OF RESOLUTION</div>
            <span className="cf-type-tag">{focusedNode.type}</span>
            <h1>{focusedNode.label}</h1>
            <p>{focusedNode.description ?? 'Capability inventory record; detailed mapping awaits verified sources.'}</p>
            <dl>
              <dt>Domain identity</dt>
              <dd>{focusedNode.id}</dd>
              <dt>Breadcrumb context</dt>
              <dd>{breadcrumb.id}</dd>
              <dt>Maturity</dt>
              <dd>{focusedNode.maturity ?? 'Not asserted'}</dd>
            </dl>
            <h2>Provenance</h2>
            {focusedNode.sourceRefs?.length ? (
              <ul>
                {focusedNode.sourceRefs.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            ) : (
              <p>No source references supplied.</p>
            )}
            {breadcrumb.incomingEdgeId &&
              (() => {
                const edge = graph.edges.get(breadcrumb.incomingEdgeId)!;
                return (
                  <section>
                    <h2>Arrival relationship</h2>
                    <dl>
                      <dt>Edge identity</dt>
                      <dd>{edge.id}</dd>
                      <dt>Direction</dt>
                      <dd>
                        {edge.source} → {edge.target}
                        {breadcrumb.reverse ? ' (traversed in reverse)' : ''}
                      </dd>
                      <dt>Type / status</dt>
                      <dd>
                        {edge.type} / {edge.status ?? 'unspecified'}
                      </dd>
                    </dl>
                    <p>{edge.contribution}</p>
                    <ul>
                      {edge.sourceRefs?.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </section>
                );
              })()}
            <h2>Already explored from here</h2>
            {breadcrumb.childBreadcrumbIds.length ? (
              <ul className="cf-history">{renderHistory(breadcrumb.id)}</ul>
            ) : (
              <p className="cf-help">Your onward explorations will stay attached here when you return.</p>
            )}
            <details className="cf-session">
              <summary>Save & restore exploration</summary>
              <div className="cf-session-actions">
                <button
                  onClick={() =>
                    safely(() => {
                      const text = serializeView(state);
                      localStorage.setItem('100monkeys-cloud-flow-session', text);
                      setSessionText(text);
                      setMessage('Session saved in this browser.');
                    })
                  }
                >
                  Save session
                </button>
                <button
                  onClick={() =>
                    safely(() => {
                      const saved = localStorage.getItem('100monkeys-cloud-flow-session');
                      if (!saved) throw new Error('No saved session in this browser');
                      commit(restoreView(graph, saved), 'Saved exploration restored.');
                    })
                  }
                >
                  Restore saved
                </button>
              </div>
              <label>
                Session JSON
                <textarea
                  value={sessionText}
                  onChange={(e) => setSessionText(e.target.value)}
                  placeholder="Paste a saved exploration…"
                  rows={5}
                />
              </label>
              <button
                onClick={() => safely(() => commit(restoreView(graph, sessionText), 'Pasted exploration restored.'))}
              >
                Restore JSON
              </button>
              <button
                onClick={() =>
                  safely(() => {
                    const url = URL.createObjectURL(new Blob([serializeView(state)], { type: 'application/json' }));
                    const a = window.document.createElement('a');
                    a.href = url;
                    a.download = 'cloud-flow-session.json';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                Download session
              </button>
            </details>
            {props.children}
          </aside>
        </div>
        <footer className="cf-status" role="status" aria-live="polite">
          <span>{message}</span>
          <span>
            {graph.nodes.size} identities · {graph.edges.size} relationships
          </span>
        </footer>
      </div>
    </CommandContext.Provider>
  );
}
