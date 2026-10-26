import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CloudFlow, parseDocument, type CloudFlowDocument } from '@100monkeys/cloud-flow';
import '@xyflow/react/dist/style.css';
import '@100monkeys/cloud-flow/style.css';
import document from './sample.json';
import './shell.css';

function Demo() {
  const [content, setContent] = useState<CloudFlowDocument>(() => parseDocument(document));
  const [error, setError] = useState('');
  return (
    <>
      <div className="demo-document-bar">
        <span>
          100 MONKEYS / EXPLORATION LAB <span className="demo-version">v0.1</span>
        </span>
        <div>
          <a href="https://github.com/chadcoulter/100monkeys-cloud-flow-widget" target="_blank" rel="noreferrer">
            Project ↗
          </a>
          <label className="demo-upload">
            Load graph JSON
            <input
              aria-label="Load graph JSON"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setContent(parseDocument(JSON.parse(await file.text()) as unknown));
                  setError('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => {
              setContent(parseDocument(document));
              setError('');
            }}
          >
            Sample inventory
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="demo-error">
          Graph could not be loaded: {error}
        </div>
      )}
      <CloudFlow
        document={content}
        initialFocusNodeId={content.nodes.some((n) => n.id === 'grail') ? 'grail' : content.nodes[0].id}
      />
    </>
  );
}
createRoot(window.document.getElementById('root')!).render(<Demo />);
