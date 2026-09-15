import { useState, useEffect } from 'react';
import { api } from './api';

interface Project { id: string; name: string; url: string; createdAt: string }
interface Run { id: string; projectId: string; status: string; startedAt: string | null; completedAt: string | null; findingsCount: number; triggerType: string }
interface Finding { id: string; type: string; severity: string; title: string; description: string; url: string; createdAt: string }

const colors = {
  bg: '#0b0f14', surface: '#131820', border: '#1e2530',
  text: '#e2e8f0', muted: '#94a3b8', red: '#ff1a1a',
  purple: '#c084fc', green: '#00ff66', teal: '#2dd4bf',
};

const sevColor: Record<string, string> = {
  critical: '#ff1a1a', high: '#f97316', medium: '#eab308', low: '#22c55e',
};

export default function App() {
  const [view, setView] = useState<'projects' | 'runs' | 'findings'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try { setProjects(await api.getProjects()); } catch { /* api not ready yet */ }
  }

  async function createProject() {
    if (!newName || !newUrl) return;
    setLoading(true);
    try {
      await api.createProject({ name: newName, url: newUrl });
      setNewName(''); setNewUrl('');
      await loadProjects();
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function openProject(p: Project) {
    setSelectedProject(p);
    setView('runs');
    try { setRuns(await api.getRuns(p.id)); } catch { setRuns([]); }
  }

  async function triggerRun() {
    if (!selectedProject) return;
    setLoading(true);
    try {
      await api.triggerRun(selectedProject.id);
      setRuns(await api.getRuns(selectedProject.id));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function openRun(r: Run) {
    setSelectedRun(r);
    setView('findings');
    try { setFindings(await api.getFindings(r.id)); } catch { setFindings([]); }
  }

  const card: React.CSSProperties = {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: '1rem', marginBottom: '0.75rem',
    cursor: 'pointer', transition: 'border-color 0.2s',
  };

  const btn: React.CSSProperties = {
    background: colors.red, color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
    fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
  };

  const input: React.CSSProperties = {
    background: colors.bg, border: `1px solid ${colors.border}`,
    color: colors.text, padding: '8px 12px', borderRadius: 6,
    fontFamily: 'inherit', fontSize: '0.85rem', flex: 1,
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${colors.border}`, padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setView('projects')}>
          <span style={{ color: colors.red, fontSize: '1.5rem' }}>⬡</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sentinel</h1>
          <span style={{ color: colors.muted, fontSize: '0.75rem' }}>by EdgeIQ Labs</span>
        </div>
        <nav style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
          <span style={{ color: view === 'projects' ? colors.red : colors.muted, cursor: 'pointer' }} onClick={() => setView('projects')}>Projects</span>
          {selectedProject && <span style={{ color: view === 'runs' ? colors.purple : colors.muted, cursor: 'pointer' }} onClick={() => openProject(selectedProject)}>Runs</span>}
        </nav>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
        {/* Projects View */}
        {view === 'projects' && (
          <div>
            <h2 style={{ color: colors.purple, marginBottom: '1rem', fontSize: '1.1rem' }}>Projects</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
              <input style={input} placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} />
              <input style={input} placeholder="https://target-url.com" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
              <button style={btn} onClick={createProject} disabled={loading}>{loading ? '...' : '+ Add'}</button>
            </div>
            {projects.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: colors.muted, cursor: 'default' }}>
                No projects yet. Create one to start scanning.
              </div>
            ) : (
              projects.map(p => (
                <div key={p.id} style={card} onClick={() => openProject(p)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = colors.purple)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: colors.text }}>{p.name}</div>
                      <div style={{ fontSize: '0.8rem', color: colors.green, marginTop: 4 }}>{p.url}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: colors.muted }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Runs View */}
        {view === 'runs' && selectedProject && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: colors.purple, fontSize: '1.1rem' }}>
                Runs — <span style={{ color: colors.green }}>{selectedProject.name}</span>
              </h2>
              <button style={btn} onClick={triggerRun} disabled={loading}>
                {loading ? 'Queuing...' : '▶ Trigger Scan'}
              </button>
            </div>
            {runs.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: colors.muted, cursor: 'default' }}>
                No runs yet. Hit "Trigger Scan" to start an autonomous crawl.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}`, color: colors.muted, textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Trigger</th>
                    <th style={{ padding: '8px 12px' }}>Started</th>
                    <th style={{ padding: '8px 12px' }}>Findings</th>
                    <th style={{ padding: '8px 12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}
                      onClick={() => openRun(r)}
                      onMouseEnter={e => (e.currentTarget.style.background = colors.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                          background: r.status === 'completed' ? `${colors.green}22` : r.status === 'running' ? `${colors.purple}22` : r.status === 'failed' ? `${colors.red}22` : `${colors.muted}22`,
                          color: r.status === 'completed' ? colors.green : r.status === 'running' ? colors.purple : r.status === 'failed' ? colors.red : colors.muted,
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: colors.muted }}>{r.triggerType}</td>
                      <td style={{ padding: '10px 12px', color: colors.muted }}>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                      <td style={{ padding: '10px 12px', color: r.findingsCount > 0 ? colors.red : colors.muted, fontWeight: 600 }}>{r.findingsCount}</td>
                      <td style={{ padding: '10px 12px', color: colors.teal }}>View →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Findings View */}
        {view === 'findings' && selectedRun && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
              <span style={{ color: colors.muted, cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setView('runs')}>← Back</span>
              <h2 style={{ color: colors.red, fontSize: '1.1rem' }}>
                Findings — Run {selectedRun.id.slice(0, 8)}
              </h2>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                background: selectedRun.status === 'completed' ? `${colors.green}22` : `${colors.purple}22`,
                color: selectedRun.status === 'completed' ? colors.green : colors.purple,
              }}>{selectedRun.status}</span>
            </div>
            {findings.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: colors.green, cursor: 'default' }}>
                ✓ No findings — clean run.
              </div>
            ) : (
              findings.map(f => (
                <div key={f.id} style={{ ...card, cursor: 'default', borderLeft: `3px solid ${sevColor[f.severity] || colors.muted}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: colors.text }}>{f.title}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: `${sevColor[f.severity]}22`, color: sevColor[f.severity] }}>
                        {f.severity.toUpperCase()}
                      </span>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', background: `${colors.purple}22`, color: colors.purple }}>
                        {f.type}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: colors.muted, marginBottom: 6 }}>{f.description}</div>
                  <div style={{ fontSize: '0.75rem', color: colors.green }}>{f.url}</div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
