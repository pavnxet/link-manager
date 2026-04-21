export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0f19', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 720, width: '100%', border: '1px solid #1f2937', borderRadius: 12, padding: 24, background: '#111827' }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Link Manager Bot Backend</h1>
        <p style={{ marginTop: 12, color: '#9ca3af' }}>
          The web dashboard is retired. Use the Telegram bot connected through the Cloudflare Worker bridge.
        </p>
        <p style={{ marginTop: 8, color: '#9ca3af' }}>
          Health endpoint: <code>/api/health</code>
        </p>
      </div>
    </main>
  )
}
