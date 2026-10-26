import type { Edge, Node } from '@xyflow/react';
import type { CloudNode, GraphIndex } from './domain.js';
import { breadcrumbPath, type CloudFlowViewState, type CloudStack, type StackMember } from './navigation.js';

export type LayoutOptions = {
  maxDepth?: number;
  maxMembers?: number;
  nodeType?: string;
  relationshipType?: string;
  viewportWidth?: number;
  wikiCards?: boolean;
};
export type CardData = Record<string, unknown> & {
  kind: 'card' | 'stack' | 'notice';
  label: string;
  subtitle?: string;
  domainNode?: CloudNode;
  breadcrumbId?: string;
  edgeId?: string | null;
  reverse?: boolean;
  stackId?: string;
  expanded?: boolean;
  focused?: boolean;
  bolted?: boolean;
  width: number;
  height: number;
};
export type CloudCanvasNode = Node<CardData>;
type Box = {
  width: number;
  height: number;
  data: CardData;
  children: { box: Box; x: number; y: number; id: string }[];
};
const GAP = 24,
  PAD = 18,
  HEADER = 80;
export function layoutCloud(
  graph: GraphIndex,
  state: CloudFlowViewState,
  options: LayoutOptions = {}
): { nodes: CloudCanvasNode[]; edges: Edge[] } {
  const nodes: CloudCanvasNode[] = [];
  const edges: Edge[] = [];
  const W = options.wikiCards ? 330 : 250;
  const H = options.wikiCards ? 360 : 126;
  const depthLimit = Math.min(8, Math.max(1, options.maxDepth ?? 3));
  const memberLimit = Math.min(50, Math.max(1, options.maxMembers ?? 8));
  let budget = 400;
  const matches = (m: Extract<StackMember, { kind: 'node' }>) =>
    (!options.nodeType || graph.nodes.get(m.id)!.type === options.nodeType) &&
    (!options.relationshipType || (m.edgeId && graph.edges.get(m.edgeId)?.type === options.relationshipType));
  function card(id: string, extra: Partial<CardData> = {}): Box {
    const domainNode = graph.nodes.get(id)!;
    return {
      width: options.wikiCards && extra.focused ? 470 : W,
      height: options.wikiCards && extra.focused ? 540 : H,
      children: [],
      data: {
        kind: 'card',
        label: domainNode.label,
        domainNode,
        width: options.wikiCards && extra.focused ? 470 : W,
        height: options.wikiCards && extra.focused ? 540 : H,
        ...extra,
      },
    };
  }
  function stackBox(stack: CloudStack, depth: number, seen: Set<string>): Box {
    const result: Box = {
      width: W + PAD * 2,
      height: HEADER,
      children: [],
      data: {
        kind: 'stack',
        label: stack.label,
        stackId: stack.id,
        expanded: stack.expanded,
        bolted: stack.bolted,
        subtitle: `${stack.orientation} · ${stack.members.length} items`,
        width: 0,
        height: 0,
        focused: state.activeStackId === stack.id,
      },
    };
    if (stack.expanded && depth < depthLimit && !seen.has(stack.id) && budget > 0) {
      const next = new Set([...seen, stack.id]);
      const members = stack.members.filter((m) => m.kind === 'stack' || matches(m));
      let x = PAD,
        y = HEADER,
        count = 0;
      for (const m of members.slice(0, memberLimit)) {
        if (--budget < 0) break;
        const child =
          m.kind === 'stack'
            ? stackBox(state.stacks[m.id], depth + 1, next)
            : card(m.id, { edgeId: m.edgeId, reverse: m.reverse });
        result.children.push({
          box: child,
          x,
          y,
          id: `${stack.id}:${m.kind}:${encodeURIComponent(m.id)}:${stack.members.indexOf(m)}`,
        });
        result.width = Math.max(result.width, x + child.width + PAD);
        result.height = Math.max(result.height, y + child.height + PAD);
        if (stack.orientation === 'horizontal') x += child.width + GAP;
        else y += child.height + GAP;
        count++;
      }
      if (count < members.length) result.data.subtitle += ` · ${members.length - count} more (use stack controls)`;
    } else if (stack.expanded) result.data.subtitle += ' · depth limit';
    result.data.width = result.width;
    result.data.height = result.height;
    return result;
  }
  function emit(box: Box, id: string, x: number, y: number) {
    nodes.push({
      id,
      type: 'cloudCard',
      position: { x, y },
      data: box.data,
      style: { width: box.width, height: box.height, pointerEvents: box.data.kind === 'stack' ? 'none' : 'all' },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: box.data.kind === 'stack' ? 0 : 3,
    });
    for (const child of box.children) emit(child.box, `${id}/${child.id}`, x + child.x, y + child.y);
  }
  const focus = card(state.focusNodeId, {
    focused: !state.activeStackId,
    breadcrumbId: state.breadcrumbHeadId,
    subtitle: 'Current focus',
  });
  let centerWidth = focus.width,
    centerHeight = focus.height;
  let excludedRoot: string | null = null;
  if (state.activeStackId) {
    let selected = state.stacks[state.activeStackId];
    const box = stackBox(selected, 0, new Set());
    emit(box, `stack-focus:${selected.id}`, 0, 0);
    centerWidth = box.width;
    centerHeight = box.height;
    emit(focus, 'focus', -W - 100, 0);
    while (selected.parentStackId) selected = state.stacks[selected.parentStackId];
    excludedRoot = selected.id;
  } else emit(focus, 'focus', 0, 0);
  const ancestors = breadcrumbPath(state).slice(0, -1);
  ancestors.slice(-memberLimit).forEach((b, i) => {
    const id = `history:${b.id}`;
    emit(
      card(b.currentNodeId, { breadcrumbId: b.id, subtitle: 'Arrival stack' }),
      id,
      -W - 100,
      (i + (state.activeStackId ? 1 : 0)) * (H + GAP)
    );
    edges.push({
      id: `route:${b.id}`,
      source: id,
      target:
        i === Math.min(ancestors.length, memberLimit) - 1
          ? 'focus'
          : `history:${ancestors.slice(-memberLimit)[i + 1].id}`,
      type: 'smoothstep',
      label: 'visited',
    });
  });
  // Onward history is recursive. Occurrence IDs come from breadcrumbs, never domain IDs.
  let branchY = 0;
  function branches(id: string, depth: number, x: number, y: number): number {
    const crumb = state.breadcrumbs[id];
    let height = 0;
    if (depth >= depthLimit) return height;
    for (const childId of crumb.childBreadcrumbIds.slice(0, memberLimit)) {
      if (--budget < 0) break;
      const child = state.breadcrumbs[childId];
      emit(
        card(child.currentNodeId, {
          breadcrumbId: childId,
          subtitle: child.arrival === 'search' ? 'Search jump · saved branch' : 'Explored branch',
        }),
        `branch:${childId}`,
        x,
        y + height
      );
      edges.push({
        id: `branch-edge:${childId}`,
        source: depth === 0 ? 'focus' : `branch:${id}`,
        target: `branch:${childId}`,
        type: 'smoothstep',
        label:
          child.arrival === 'search'
            ? 'search jump'
            : graph.edges.get(child.incomingEdgeId!)?.type.replaceAll('_', ' '),
      });
      const nested = branches(childId, depth + 1, x + W + 80, y + height);
      height += Math.max(H, nested) + GAP;
    }
    return height;
  }
  branchY = branches(state.breadcrumbHeadId, 0, centerWidth + 100, 0);
  const roots = Object.values(state.stacks).filter(
    (s) => s.anchorBreadcrumbId === state.breadcrumbHeadId && !s.parentStackId && s.id !== excludedRoot
  );
  const laneCursor = {
    top: -100,
    bottom:
      Math.max(centerHeight, branchY, ancestors.length ? Math.min(ancestors.length, memberLimit) * (H + GAP) : H) + 100,
    left: Math.max(centerHeight, ancestors.length * (H + GAP)) + 100,
    right: options.wikiCards && !branchY ? 0 : Math.max(branchY, centerHeight) + 100,
  };
  const rootBoxes = roots.map((s) => ({ s, box: stackBox(s, 0, new Set()) }));
  // Reserve the full width of the top/bottom lanes before placing side stacks.
  const middleWidth = Math.max(
    centerWidth,
    ...rootBoxes.filter(({ s }) => s.side === 'top' || s.side === 'bottom').map(({ box }) => box.width)
  );
  if (options.wikiCards)
    laneCursor.bottom = Math.max(
      laneCursor.bottom,
      laneCursor.right +
        rootBoxes.filter(({ s }) => s.side === 'right').reduce((height, { box }) => height + box.height + GAP, 0) +
        100
    );
  for (const { s, box } of rootBoxes) {
    let x = 0,
      y = 0;
    if (s.side === 'top') {
      y = laneCursor.top - box.height;
      laneCursor.top = y - GAP;
    }
    if (s.side === 'bottom') {
      y = laneCursor.bottom;
      laneCursor.bottom += box.height + GAP;
    }
    if (s.side === 'left') {
      x = -box.width - W - 200;
      y = laneCursor.left;
      laneCursor.left += box.height + GAP;
    }
    if (s.side === 'right') {
      x = options.wikiCards ? centerWidth + 60 : middleWidth + 100;
      y = laneCursor.right;
      laneCursor.right += box.height + GAP;
    }
    emit(box, `stack:${s.id}`, x, y);
  }
  return { nodes, edges };
}
