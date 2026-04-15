import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  state = { err: null }

  static getDerivedStateFromError(err) {
    return { err }
  }

  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#1a1d2e', color: '#ef4444', minHeight: '100vh' }}>
          <h2>App Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.err.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#9ca3af', marginTop: 12 }}>{this.state.err.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

try {
  createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  )
} catch (e) {
  document.body.innerHTML = `<div style="padding:24px;font-family:monospace;background:#1a1d2e;color:#ef4444"><h2>Init Error</h2><pre>${e.message}\n${e.stack}</pre></div>`
}
