import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type NodeProps } from '@xyflow/react';
import { indexGraph, type CloudFlowDocument, type WikiDocument } from './domain.js';
import {
  back,
  boltStack,
  breadcrumbPath,
  createView,
  focusBreadcrumb,
  focusStack,
  openPage,
  restoreView,
  serializeView,
  toggleStack,
  type Breadcrumb,
  type CloudFlowViewState,
} from './navigation.js';
import { layoutCloud, type CloudCanvasNode } from './layout.js';

export type WikiStacksProps = {
  document: WikiDocument | CloudFlowDocument;
  initialFocusNodeId?: string;
  initialViewState?: CloudFlowViewState;
  viewState?: CloudFlowViewState;
  onViewStateChange?: (state: CloudFlowViewState) => void;
  onFocusChange?: (nodeId: string, breadcrumb: Breadcrumb) => void;
  reducedMotion?: boolean;
  className?: string;
  children?: ReactNode;
};
type WikiCommands = {
  open: (id: string, fromId?: string) => void;
  visit: (id: string) => void;
  toggle: (id: string) => void;
  focus: (id: string) => void;
  bolt: (id: string | null) => void;
  labels: Map<string, string>;
  linked: Map<string, Array<{ id: string; label: string }>>;
};
const WikiContext = createContext<WikiCommands | null>(null);
function WikiInline({ text, sourceId }: { text: string; sourceId: string }) {
  const actions = useContext(WikiContext)!;
  return (
    <>
      {text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
        if (part.startsWith('[[')) {
          const [id, label] = part.slice(2, -2).split('|');
          return (
            <button className="wiki-inline-link" key={i} onClick={() => actions.open(id, sourceId)}>
              {label ?? actions.labels.get(id) ?? id}
            </button>
          );
        }
        if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        return part;
      })}
    </>
  );
}
function WikiBody({ content, sourceId }: { content: string; sourceId: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^#{1,3} /.test(line)) {
      blocks.push(
        <h3 key={i}>
          <WikiInline text={line.replace(/^#{1,3} /, '')} sourceId={sourceId} />
        </h3>
      );
      continue;
    }
    if (/^- /.test(line)) {
      const start = i;
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      i--;
      blocks.push(
        <ul key={start}>
          {items.map((item, j) => (
            <li key={j}>
              <WikiInline text={item} sourceId={sourceId} />
            </li>
          ))}
        </ul>
      );
      continue;
    }
    const start = i;
    const paragraph = [line];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#{1,3} |- )/.test(lines[i + 1]))
      paragraph.push(lines[++i]);
    blocks.push(
      <p key={start}>
        <WikiInline text={paragraph.join(' ')} sourceId={sourceId} />
      </p>
    );
  }
  return <>{blocks}</>;
}
function WikiCanvasCard({ data }: NodeProps<CloudCanvasNode>) {
  const actions = useContext(WikiContext)!;
  if (data.kind === 'stack')
    return (
      <section
        className={`wiki-stack ${data.bolted ? 'wiki-stack-bolted' : ''} ${data.focused ? 'wiki-stack-focused' : ''}`}
        style={{ width: data.width, height: data.height }}
        aria-label={`Stack ${data.label}`}
      >
        <div className="wiki-stack-heading nodrag nopan">
          <button
            aria-label={`${data.expanded ? 'Collapse' : 'Expand'} stack ${data.label}`}
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
            aria-label={`Focus stack ${data.label}`}
            title="Focus stack"
            onClick={() => actions.focus(data.stackId!)}
          >
            ◎
          </button>
          <button
            aria-label={`Bolt onto stack ${data.label}`}
            title="Add a nested stack"
            onClick={() => actions.bolt(data.stackId!)}
          >
            ↗
          </button>
        </div>
      </section>
    );
  const page = data.domainNode!;
  return (
    <article
      className={`wiki-page ${data.focused ? 'wiki-page-focused' : ''}`}
      style={{ width: data.width, height: data.height }}
      aria-label={`Wiki page ${page.label}`}
      aria-current={data.focused ? 'page' : undefined}
    >
      <header className="wiki-page-header">
        <span>{data.breadcrumbId ? (data.focused ? 'READING NOW' : 'YOUR EXPLORATION') : 'WIKI PAGE'}</span>
        <button
          className="wiki-page-heading nodrag nopan"
          aria-label={`Open page ${page.label}`}
          onClick={() => (data.breadcrumbId ? actions.visit(data.breadcrumbId) : actions.open(page.id))}
        >
          {page.label}
        </button>
      </header>
      <div className="wiki-page-content nodrag nopan nowheel" tabIndex={0} aria-label={`Content of ${page.label}`}>
        <WikiBody content={page.content ?? page.description ?? ''} sourceId={page.id} />
        {!!actions.linked.get(page.id)?.length && (
          <div className="wiki-related">
            <h3>Related pages</h3>
            {actions.linked.get(page.id)!.map((link) => (
              <button key={link.id} onClick={() => actions.open(link.id, page.id)}>
                {link.label} <span>↗</span>
              </button>
            ))}
          </div>
        )}
        {!!page.sourceRefs?.length && (
          <details className="wiki-sources">
            <summary>Sources</summary>
            <ul>
              {page.sourceRefs.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <footer className="wiki-page-footer nodrag nopan">
        <span>{data.focused ? 'Current page' : data.breadcrumbId ? 'Saved visit' : 'From your wiki'}</span>
        {!data.focused && (
          <button onClick={() => (data.breadcrumbId ? actions.visit(data.breadcrumbId) : actions.open(page.id))}>
            {data.breadcrumbId ? 'Return here' : 'Read page'} →
          </button>
        )}
      </footer>
    </article>
  );
}
const wikiNodeTypes = { cloudCard: WikiCanvasCard };
export function WikiStacks(props: WikiStacksProps) {
  const graph = useMemo(() => indexGraph(props.document), [props.document]);
  return (
    <ReactFlowProvider>
      <WikiExplorer key={JSON.stringify(graph.document)} {...props} graph={graph} />
    </ReactFlowProvider>
  );
}
function WikiExplorer({ graph, ...props }: WikiStacksProps & { graph: ReturnType<typeof indexGraph> }) {
  const startId = props.initialFocusNodeId ?? graph.document.presentation?.startNodeId ?? graph.document.nodes[0].id;
  const [local, setLocal] = useState(() =>
    props.initialViewState ? restoreView(graph, props.initialViewState) : createView(graph, startId)
  );
  const controlled = useMemo(
    () => (props.viewState ? restoreView(graph, props.viewState) : null),
    [graph, props.viewState]
  );
  const state = controlled ?? local;
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('Choose a wiki card or follow a link to read.');
  const [sessionText, setSessionText] = useState('');
  const [recenter, setRecenter] = useState(0);
  const [motion, setMotion] = useState(
    () =>
      props.reducedMotion ??
      (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
  const [depth, setDepth] = useState(4);
  const [members, setMembers] = useState(8);
  const flow = useReactFlow<CloudCanvasNode>();
  const container = useRef<HTMLDivElement>(null);
  const layout = useMemo(
    () => layoutCloud(graph, state, { wikiCards: true, maxDepth: depth, maxMembers: members }),
    [graph, state, depth, members]
  );
  const crumb = state.breadcrumbs[state.breadcrumbHeadId];
  const path = breadcrumbPath(state);
  function commit(next: CloudFlowViewState, text: string) {
    if (!props.viewState) setLocal(next);
    props.onViewStateChange?.(next);
    setMessage(text);
  }
  function safely(action: () => void) {
    try {
      action();
    } catch (error) {
      setMessage(`Could not restore: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const actions: WikiCommands = {
    open(id, fromId) {
      const from = fromId && fromId !== state.focusNodeId ? openPage(graph, state, fromId) : state;
      commit(openPage(graph, from, id), `Reading ${graph.nodes.get(id)!.label}.`);
      setQuery('');
    },
    visit(id) {
      commit(focusBreadcrumb(state, id), 'Your page and its onward stacks are restored.');
    },
    toggle(id) {
      commit(
        toggleStack(state, id),
        `${state.stacks[id].label} ${state.stacks[id].expanded ? 'collapsed' : 'expanded'}.`
      );
    },
    focus(id) {
      commit(focusStack(state, id), `Focused ${state.stacks[id].label}.`);
    },
    bolt(id) {
      commit(boltStack(state, id), 'New exploration stack added.');
    },
    labels: new Map(graph.document.nodes.map((n) => [n.id, n.label])),
    linked: new Map(
      graph.document.nodes.map((n) => [
        n.id,
        graph.outgoing
          .get(n.id)!
          .map((e) => ({ id: e.target, label: e.contribution ?? graph.nodes.get(e.target)!.label })),
      ])
    ),
  };
  const notified = useRef('');
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof Node &&
          event.target !== window.document.body &&
          !container.current?.contains(event.target))
      )
        return;
      if ((event.altKey && event.key === 'ArrowLeft') || (event.key === 'Escape' && state.activeStackId)) {
        event.preventDefault();
        const next = back(state);
        if (!props.viewState) setLocal(next);
        props.onViewStateChange?.(next);
        setMessage('Returned to your previous page.');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, props.viewState, props.onViewStateChange]);
  useEffect(() => {
    if (notified.current !== crumb.id) {
      notified.current = crumb.id;
      props.onFocusChange?.(state.focusNodeId, crumb);
    }
  }, [crumb, state.focusNodeId, props.onFocusChange]);
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
    const target = layout.nodes.find((n) => n.data.focused);
    const frame = requestAnimationFrame(() => {
      if (target)
        void flow.setCenter(
          target.position.x + target.data.width / 2,
          target.position.y + Math.min(target.data.height, 540) / 2,
          { zoom: 0.78, duration: motion ? 0 : 220 }
        );
    });
    return () => cancelAnimationFrame(frame);
  }, [state.breadcrumbHeadId, state.activeStackId, recenter, motion, flow.setCenter]);
  const roots = Object.values(state.stacks).filter((s) => s.anchorBreadcrumbId === crumb.id && !s.parentStackId);
  const results = graph.document.nodes.filter((n) =>
    `${n.label} ${n.content ?? ''} ${n.description ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
  function stackControls(id: string, level = 0): ReactNode {
    if (level > 8) return null;
    const s = state.stacks[id];
    return (
      <li key={id}>
        <div>
          <button aria-expanded={s.expanded} onClick={() => actions.toggle(id)}>
            {s.expanded ? '−' : '+'} {s.label}
          </button>
          <button aria-label={`Center ${s.label}`} onClick={() => actions.focus(id)}>
            ◎
          </button>
          <button aria-label={`Nest a stack in ${s.label}`} onClick={() => actions.bolt(id)}>
            ↗
          </button>
        </div>
        {s.expanded && (
          <ul>
            {s.members.slice(0, members).map((m, i) =>
              m.kind === 'stack' ? (
                stackControls(m.id, level + 1)
              ) : (
                <li key={`${m.id}:${i}`}>
                  <button onClick={() => actions.open(m.id)}>{graph.nodes.get(m.id)!.label}</button>
                </li>
              )
            )}
          </ul>
        )}
      </li>
    );
  }
  return (
    <WikiContext.Provider value={actions}>
      <div
        className={`wiki-reader ${props.className ?? ''}`}
        ref={container}
        onKeyDown={(e) => {
          if ((e.altKey && e.key === 'ArrowLeft') || (e.key === 'Escape' && state.activeStackId)) {
            e.preventDefault();
            commit(back(state), 'Returned to your previous page.');
          }
        }}
      >
        <header className="wiki-topbar">
          <div className="wiki-brand">
            <span>100</span>
            <div>
              <small>MONKEYS / CLOUD FLOW</small>
              <strong>{graph.document.presentation?.title ?? 'Wiki card stacks'}</strong>
            </div>
          </div>
          <div className="wiki-search">
            <label>
              <span className="wiki-sr-only">Search wiki</span>
              <input placeholder="Search your wiki…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {query && (
              <div className="wiki-search-results">
                {results.slice(0, 20).map((page) => (
                  <button key={page.id} onClick={() => actions.open(page.id)}>
                    <strong>{page.label}</strong>
                    <small>{page.description ?? page.content?.slice(0, 100)}</small>
                  </button>
                ))}
                {!results.length && <p>No pages found.</p>}
              </div>
            )}
          </div>
          <details className="wiki-menu">
            <summary>Exploration ⋯</summary>
            <div className="wiki-menu-panel">
              <button onClick={() => actions.bolt(state.activeStackId)}>Bolt a new stack</button>
              <button onClick={() => commit(createView(graph, startId), 'Returned to the starting page.')}>
                Start over
              </button>
              <label>
                <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} /> Reduce motion
              </label>
              <label>
                Stack depth
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={depth}
                  onChange={(e) => setDepth(Math.max(1, Math.min(8, Number(e.target.value))))}
                />
              </label>
              <label>
                Cards per stack
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={members}
                  onChange={(e) => setMembers(Math.max(1, Math.min(50, Number(e.target.value))))}
                />
              </label>
              <hr />
              <button
                onClick={() =>
                  safely(() => {
                    const json = serializeView(state);
                    localStorage.setItem('100monkeys-wiki-session', json);
                    setSessionText(json);
                    setMessage('Exploration saved in this browser.');
                  })
                }
              >
                Save exploration
              </button>
              <button
                onClick={() =>
                  safely(() => {
                    const saved = localStorage.getItem('100monkeys-wiki-session');
                    if (!saved) throw new Error('No saved exploration');
                    commit(restoreView(graph, saved), 'Exploration restored.');
                  })
                }
              >
                Restore exploration
              </button>
              <label>
                Exploration JSON
                <textarea value={sessionText} rows={3} onChange={(e) => setSessionText(e.target.value)} />
              </label>
              <button onClick={() => safely(() => commit(restoreView(graph, sessionText), 'Exploration restored.'))}>
                Restore JSON
              </button>
            </div>
          </details>
        </header>
        <nav className="wiki-trail" aria-label="Breadcrumb stack">
          <button
            disabled={!crumb.previousBreadcrumbId && !state.activeStackId}
            onClick={() => commit(back(state), 'Returned to your previous page.')}
          >
            ← Back
          </button>
          <div>
            {path.map((b, i) => (
              <span key={b.id}>
                {i > 0 && <span aria-hidden="true"> / </span>}
                <button aria-current={b.id === crumb.id ? 'page' : undefined} onClick={() => actions.visit(b.id)}>
                  {graph.nodes.get(b.currentNodeId)!.label}
                </button>
              </span>
            ))}
          </div>
        </nav>
        <main className="wiki-canvas" aria-label="Wiki card stacks">
          <div className="wiki-canvas-caption">
            <span>YOUR KNOWLEDGE, UNFOLDED</span>
            <p>Read a card. Follow a link. Keep the trail.</p>
          </div>
          <div className="wiki-flow-surface" style={{ position: 'absolute', inset: 0 }}>
            <ReactFlow<CloudCanvasNode>
              nodes={layout.nodes}
              edges={[]}
              nodeTypes={wikiNodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              deleteKeyCode={null}
              minZoom={0.12}
              maxZoom={1.6}
            >
              <Background color="#d9d3c7" gap={28} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div className="wiki-canvas-tools">
            <button onClick={() => setRecenter((n) => n + 1)}>Center reading</button>
            <button
              onClick={() => {
                void flow.fitView({ padding: 0.08, duration: motion ? 0 : 220 });
              }}
            >
              See all stacks
            </button>
          </div>
          <details className="wiki-outline">
            <summary>Browse stacks</summary>
            <ul>{roots.map((s) => stackControls(s.id))}</ul>
          </details>
        </main>
        <footer className="wiki-status" role="status" aria-live="polite">
          <span>{message}</span>
          <span>
            {graph.nodes.size} pages · {Object.keys(state.breadcrumbs).length} visits
          </span>
        </footer>
        {props.children}
      </div>
    </WikiContext.Provider>
  );
}
