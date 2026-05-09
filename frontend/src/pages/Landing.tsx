import React from 'react';
import { Link } from 'react-router-dom';
import GlobeAscii from '../components/GlobeAscii';

const Landing: React.FC = () => (
  <div
    className="bg-bg text-fg flex flex-col"
    style={{ fontSize: 14, height: '100%', overflow: 'hidden', position: 'relative' }}
  >

    {/* ── Globe: full-page background watermark ── */}
    <div
      style={{
        position:  'absolute',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        opacity:   0.09,
        pointerEvents: 'none',
        zIndex: 0,
        // Fade edges so it doesn't hard-clip
        maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)',
      }}
    >
      <GlobeAscii cols={90} rows={45} speed={0.003} />
    </div>

    {/* ── All page content sits above the globe ── */}
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-3 border-b border-border shrink-0">
        <span className="mono text-sm font-medium">3P</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-muted hover:text-fg transition-colors">Sign in</Link>
          <Link to="/register"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
            className="text-sm px-4 py-1.5">
            Register
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs text-muted mb-6 mono border border-border px-3 py-1">Beta</p>
        <h1 className="text-5xl font-semibold tracking-tight mb-4">3P Chat</h1>
        <p className="text-base text-muted max-w-xs mb-10 leading-relaxed">
          Peer-to-peer, end-to-end encrypted chat. No servers store your messages.
        </p>
        <div className="flex gap-3 mb-16">
          <Link to="/login" className="px-6 py-2.5 border border-border text-sm hover:bg-surface transition-colors">
            Sign in
          </Link>
          <Link to="/register"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
            className="px-6 py-2.5 text-sm">
            Get started
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-10 max-w-lg w-full text-left border-t border-border pt-10">
          {[
            { tag: 'Encrypted', label: 'AES-256-GCM',   desc: 'Every message encrypted on your device before sending' },
            { tag: 'Direct',    label: 'WebRTC P2P',     desc: 'No relay server when peers can connect directly' },
            { tag: 'Private',   label: 'Zero Knowledge', desc: 'Your keys never leave your device' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-muted mb-1">{f.tag}</p>
              <p className="text-sm font-medium mb-1">{f.label}</p>
              <p className="text-xs text-muted leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-border px-8 py-3 flex justify-between shrink-0">
        <span className="mono text-xs text-dim">3P Protocol</span>
        <span className="text-xs text-dim">AES · WebRTC · E2E</span>
      </footer>

    </div>
  </div>
);

export default Landing;
