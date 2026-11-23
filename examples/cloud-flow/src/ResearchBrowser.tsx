import { useState } from 'react';
import research from './symmetric-research.json';
import './research.css';

type Section = (typeof research.sections)[number];

export function ResearchBrowser() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const sections: Section[] = research.sections;
  const current = sections.find(section => section.id === currentId);
  const matches = sections.filter(section => (section.title + ' ' + section.intro + ' ' + section.points.join(' ')).toLowerCase().includes(query.trim().toLowerCase()));
  function open(id: string) {
    if (id === currentId) return;
    if (currentId) setTrail(previous => [...previous, currentId]);
    setCurrentId(id);
    setExpanded(null);
  }
  function back() {
    if (trail.length) {
      setCurrentId(trail[trail.length - 1]);
      setTrail(trail.slice(0, -1));
    } else {
      setCurrentId(null);
    }
    setExpanded(null);
  }
  function reset() {
    setCurrentId(null);
    setTrail([]);
    setQuery('');
    setExpanded(null);
  }

  return (
    <main className="research-viewport" aria-label="Research information browser">
      <header className="research-header">
        <div>
          <span className="research-eyebrow">100 MONKEYS / RESEARCH / CRYPTOGRAPHY</span>
          <h1>{research.title}</h1>
          <p>{research.summary}</p>
        </div>
        <button className="research-compact-button" onClick={reset}>All research topics</button>
      </header>
      <div className="research-frame">
        <nav className="research-sidebar" aria-label="Research topics">
          <label htmlFor="research-search">Explore this research</label>
          <input id="research-search" type="search" placeholder="Search subjects" value={query} onChange={event => setQuery(event.target.value)} />
          <div className="research-nav-scroll">
            {matches.length === 0 && <p role="status">No matching topics.</p>}
            {matches.map(section => (
              <button
                key={section.id}
                className={'research-topic' + (currentId === section.id ? ' is-active' : '')}
                aria-current={currentId === section.id ? 'page' : undefined}
                onClick={() => open(section.id)}
              >
                <small>{section.eyebrow}</small>
                <strong>{section.title}</strong>
                <span>{section.intro}</span>
              </button>
            ))}
          </div>
        </nav>
        <section className="research-content" aria-label="Research content">
          <div className="research-toolbar">
            <div className="research-breadcrumbs" aria-label="Reading path">
              <button onClick={reset}>Symmetric Encryption</button>
              {trail.map((id, index) => {
                const label = sections.find(section => section.id === id)?.title ?? id;
                return (
                  <span key={index}><span aria-hidden="true">/</span><button onClick={() => {
                    setCurrentId(id);
                    setTrail(trail.slice(0, index));
                    setExpanded(null);
                  }}>{label}</button></span>
                );
              })}
              {current && <span aria-current="page"><span aria-hidden="true">/</span>{current.title}</span>}
            </div>
            {current && <button onClick={back} className="research-compact-button">← Back</button>}
          </div>
          <div className="research-content-scroll" key={currentId ?? 'home'}>
            {!current ? (
              <>
                <div className="research-introduction">
                  <span className="research-eyebrow">TECHNOLOGY SHOWCASE</span>
                  <h2>Symmetric Encryption</h2>
                  <p>Efficient encryption, authentication, and integrity verification for high-volume business systems.</p>
                  <p>Explore what the technology does, where businesses use it, and the commercial advantages of shared-key operations.</p>
                </div>
                <div className="research-card-grid">
                  {sections.map(section => (
                    <button className="research-info-card" key={section.id} onClick={() => open(section.id)}>
                      <small>{section.eyebrow}</small>
                      <strong>{section.title}</strong>
                      <span>{section.intro}</span>
                      <b>Explore →</b>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <article className="research-article">
                <span className="research-eyebrow">{current.eyebrow}</span>
                <h2>{current.title}</h2>
                <p className="research-lead">{current.intro}</p>
                <div className="research-points">
                  {current.points.map((point, index) => (
                    <button key={point} className="research-point" aria-expanded={expanded === point} onClick={() => setExpanded(expanded === point ? null : point)}>
                      <span className="research-point-number">{String(index + 1).padStart(2, '0')}</span>
                      <span>{point}</span>
                      <span aria-hidden="true">{expanded === point ? '−' : '+'}</span>
                      {expanded === point && <small className="research-point-detail">Explore the related subjects below or request a demonstration of this capability.</small>}
                    </button>
                  ))}
                </div>
                <h3>Continue exploring</h3>
                <div className="research-related">
                  {current.related.map(id => {
                    const next = sections.find(section => section.id === id);
                    return next ? <button key={id} onClick={() => open(id)}>{next.title} <span aria-hidden="true">↗</span></button> : null;
                  })}
                </div>
              </article>
            )}
            <div className="research-contact">
              <div><strong>See this technology in action</strong><p>Ask us to demonstrate how it can support your business.</p></div>
              <a href={`mailto:info@100monkeys.com?subject=${encodeURIComponent('Demonstration request: Symmetric Encryption' + (current ? ' / ' + current.title : ''))}`}>Request a demonstration ↗</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
