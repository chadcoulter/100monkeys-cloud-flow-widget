# Wiki cards from JSON

The default demo is a wiki reader built from JSON. Each page becomes a card containing its text. Stack definitions group those page cards horizontally or vertically and can contain other stacks. A page can appear in several stacks without creating another page identity.

Open the demo and choose **Edit JSON**, change its pages or stacks, then choose **Build stacks**. **Load wiki JSON** accepts the same format from a file. The working sample is `examples/cloud-flow/src/wiki.json`.

```json
{
  "format": "wiki-stacks",
  "schemaVersion": "1.0",
  "title": "My wiki",
  "startPageId": "home",
  "pages": [
    {
      "id": "home",
      "title": "Home",
      "content": "This is my wiki. Read [[notes|my notes]]."
    },
    {
      "id": "notes",
      "title": "Notes",
      "content": "## A section\nThese paragraphs are displayed inside the card.\n\n- First item\n- Second item\n\nReturn to [[home]]."
    }
  ],
  "stacks": [
    {
      "id": "reading",
      "title": "Reading stack",
      "anchorPageId": "home",
      "orientation": "vertical",
      "side": "right",
      "members": [{ "pageId": "notes" }]
    }
  ]
}
```

## Pages

`id` is a stable unique identity. `title` supplies the card heading. `content` supplies the body, with blank lines between paragraphs, `#`, `##`, or `###` headings, `- ` lists, `**bold text**`, and `[[page-id]]` or `[[page-id|display text]]` wiki links. This is a small text format, not a full Markdown engine. Raw HTML is displayed as text.

Optional `summary` is used in search results. Optional `sourceRefs` is an array of source descriptions displayed within the card. Optional `links` accepts `{ "target": "other-page-id", "label": "Related reading" }` entries. These and inline wiki links generate the related-pages list. Wiki cross-references are reading links, not assertions of technical dependency or implementation.

## Nested stacks

`anchorPageId` says which focused page displays this stack. `orientation` is horizontal or vertical; `side` is top, bottom, left, or right. `members` is an ordered array of `{ "pageId": "..." }` and/or `{ "stackId": "..." }`. `expanded` is optional and defaults to true. A stack referenced by another stack is nested inside it. Nested stacks use the same anchor page as their enclosing stack. Stack nesting cycles are rejected; cycles between wiki pages are allowed.

For example, a horizontal root can contain a page and a vertical stack:

```json
[
  { "id": "overview", "title": "Overview", "anchorPageId": "home", "orientation": "horizontal", "side": "right", "members": [{ "pageId": "intro" }, { "stackId": "references" }] },
  { "id": "references", "title": "References", "anchorPageId": "home", "orientation": "vertical", "side": "right", "members": [{ "pageId": "notes" }, { "pageId": "sources" }] }
]
```

Every referenced page must exist in `pages`. A stack can reference a page without declaring a wiki link to it; grouping does not create a domain relationship. Pages without explicit stack definitions receive linked-page/reference stacks from their wiki links.

## Reading and exploration

The large card is the current page. Read it directly, scroll its text, follow an inline link, or open another card. If a link is followed inside a peripheral card, the trail includes that source card before the destination. Your arrival stack and onward visits remain available when you go back. A separate route can refer to the same page identity.

The stack header offers collapse/expand, focus and nested bolting. **Browse stacks** exposes the same operations and page links in an outline when a stack is outside the viewport. **Center reading** recenters the current card; **See all stacks** fits the whole exploration. **Exploration** holds save/restore, rendering limits and reduced motion. Tab/Enter work with links and cards; Alt + Left goes back. Pan/zoom explores large stacks without clipping their content.

## Importing the widget

```tsx
import { WikiStacks, type WikiDocument } from '@100monkeys/cloud-flow';
import '@xyflow/react/dist/style.css';
import '@100monkeys/cloud-flow/style.css';

export function Wiki({ document }: { document: WikiDocument }) {
  return <div style={{ height: '100vh' }}><WikiStacks document={document} /></div>;
}
```

`CloudFlow` also accepts this wiki JSON and selects the wiki reader automatically. `WikiStacks` supports controlled `viewState`/`onViewStateChange`, `initialViewState`, `initialFocusNodeId`, `onFocusChange`, and `reducedMotion`. `parseWikiDocument` validates input and returns the shared graph representation with page content and explicit stack presentation. `openPage` preserves navigation without inventing relationships for unlinked stack cards. The original node/edge input remains supported for existing consumers.
