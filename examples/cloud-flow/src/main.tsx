import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CloudFlow, parseDocument, type CloudFlowDocument } from '@100monkeys/cloud-flow';
import '@xyflow/react/dist/style.css';
import '@100monkeys/cloud-flow/style.css';
import document from './sample.json';
import wiki from './wiki.json';
import './shell.css';

function Demo() {
  const legacy = new URLSearchParams(window.location.search).get('demo') === 'graph';
  const [source, setSource] = useState<unknown>(() => (legacy ? document : wiki));
  const [content, setContent] = useState<CloudFlowDocument>(() => parseDocument(source));
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [json, setJson] = useState('');
  function apply(value: unknown) {
    const parsed = parseDocument(value);
    setContent(parsed);
    setSource(value);
    setError('');
  }
  return (
    <>
      <div className="demo-document-bar">
        <span>
          100 MONKEYS / WIKI CARD STACKS <span className="demo-version">v0.2</span>
        </span>
        <div>
          <a href="https://github.com/chadcoulter/100monkeys-cloud-flow-widget" target="_blank" rel="noreferrer">
            Project ↗
          </a>
          <label className="demo-upload">
            {legacy ? 'Load graph JSON' : 'Load wiki JSON'}
            <input
              aria-label={legacy ? 'Load graph JSON' : 'Load wiki JSON'}
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  apply(JSON.parse(await file.text()) as unknown);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => {
              apply(legacy ? document : wiki);
            }}
          >
            {legacy ? 'Sample inventory' : 'Sample wiki'}
          </button>
          <button
            onClick={() => {
              setJson(JSON.stringify(source, null, 2));
              setEditing(true);
            }}
          >
            Edit JSON
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="demo-error">
          JSON could not be loaded: {error}
        </div>
      )}
      <CloudFlow
        document={content}
        initialFocusNodeId={
          content.presentation?.startNodeId ??
          (content.nodes.some((n) => n.id === 'grail') ? 'grail' : content.nodes[0].id)
        }
      />
      {editing && (
        <dialog
          className="demo-json-backdrop"
          aria-label="Wiki JSON editor"
          onCancel={() => setEditing(false)}
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
        >
          <section className="demo-json-editor">
            <header>
              <h2>Build your card stacks from JSON</h2>
              <button onClick={() => setEditing(false)}>Close editor</button>
            </header>
            <p>Pages provide the wiki content. Stacks define how their cards are grouped, ordered, and nested.</p>
            <label>
              Wiki JSON
              <textarea autoFocus value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
            </label>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button
                onClick={() => {
                  try {
                    apply(JSON.parse(json) as unknown);
                    setEditing(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Build stacks
              </button>
            </footer>
          </section>
        </dialog>
      )}
    </>
  );
}
createRoot(window.document.getElementById('root')!).render(<Demo />);
