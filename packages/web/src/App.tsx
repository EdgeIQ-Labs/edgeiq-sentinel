function App() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
          <span style={{ color: 'var(--red)' }}>⬡</span> Sentinel
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Agentic QA Platform — Autonomous bug discovery & reporting
        </p>
      </header>

      <section>
        <h2 style={{ color: 'var(--purple)', marginBottom: '1rem' }}>Dashboard</h2>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <p>No projects yet. Create one via the API to get started.</p>
          <code style={{ display: 'block', marginTop: '1rem', color: 'var(--green)' }}>
            POST /api/projects {'{'} "name": "my-app", "url": "https://example.com" {'}'}
          </code>
        </div>
      </section>
    </div>
  );
}

export default App;
