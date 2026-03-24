import { Link } from 'react-router-dom';
import { Shield, Lock, Zap } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="landing-container">
      <nav className="glass-panel nav-bar animate-fade-in">
        <div className="logo">
          <Shield size={24} color="var(--accent-primary)" />
          <span>SecureChat</span>
        </div>
        <div className="nav-links" style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
          <Link to="/auth" className="btn-secondary">Login</Link>
          <Link to="/auth" className="btn-primary">Get Started</Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-content animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="badge">Zero-Spam Architecture</div>
          <h1 className="hero-title">
            The World's Most <span className="gradient-text">Private</span> Chat Network.
          </h1>
          <p className="hero-subtitle">
            Say goodbye to unsolicited messages and spam. In SecureChat, connection requires mutual approval. With features like the ephemeral Dark Room and evaporating messages, your data is finally yours.
          </p>
          <div className="hero-actions">
            <Link to="/auth" className="btn-primary large-btn">Start Secure Chat</Link>
          </div>
        </div>

        <div className="features-grid animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="feature-card glass-panel">
            <Shield className="feature-icon" />
            <h3>Approval Required</h3>
            <p>No one can message you without your explicit consent via a connection request.</p>
          </div>
          <div className="feature-card glass-panel">
            <Lock className="feature-icon" />
            <h3>Dark Room</h3>
            <p>Split-key ephemeral chat mode that bypasses our persistent databases entirely.</p>
          </div>
          <div className="feature-card glass-panel">
            <Zap className="feature-icon" />
            <h3>Evaporating Data</h3>
            <p>Set messages to automatically self-destruct after they have been viewed.</p>
          </div>
        </div>

        <div className="reviews-section animate-fade-in" style={{ animationDelay: '0.6s', marginTop: '4rem', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '2rem', color: 'var(--accent-primary)' }}>App Ratings & Reviews</h2>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div className="review-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '8px', minWidth: '250px', border: '1px solid var(--border)' }}>
              <div style={{ color: '#fbbf24', fontSize: '1.5rem' }}>★★★★★</div>
              <p style={{ margin: '1rem 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>"The darkroom feature is exactly what I needed. Truly the most secure chat app out there."</p>
              <span style={{ fontWeight: 'bold' }}>- Alex D.</span>
            </div>
            <div className="review-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '8px', minWidth: '250px', border: '1px solid var(--border)' }}>
              <div style={{ color: '#fbbf24', fontSize: '1.5rem' }}>★★★★★</div>
              <p style={{ margin: '1rem 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>"Evaporating messages work flawlessly. Beautiful and safe UI."</p>
              <span style={{ fontWeight: 'bold' }}>- Sarah K.</span>
            </div>
          </div>
          <div style={{ marginTop: '2rem', fontSize: '1.2rem' }}>
            <strong>Average Rating:</strong> 4.9/5 (10k+ Downloads)
          </div>
        </div>
      </main>
      
      <footer style={{marginTop: '4rem', padding: '2rem', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', width: '100%'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
            <Shield size={20} color="var(--accent-primary)" />
            <span style={{fontWeight: 'bold', color: 'var(--text-primary)'}}>SecureChat Ecosystem</span>
          </div>
          <p style={{fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto'}}>
            Designed with advanced cryptographic tunneling and ephemeral data policies. We don't read your messages because we physically can't. Welcome to the future of privacy.
          </p>
          <div style={{display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.85rem', marginTop: '1rem'}}>
            <span style={{cursor: 'pointer'}}>Privacy Protocol</span>
            <span style={{cursor: 'pointer'}}>Terms of Network</span>
            <span style={{cursor: 'pointer'}}>Contact Ghost Admins</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.9rem', marginTop: '1rem', color: 'var(--text-primary)'}}>
            <strong>Contact Us:</strong>
            <span>📞 Mobile: +1 (555) 123-4567</span>
            <span>✉️ Gmail: support@securechat.com</span>
          </div>
          <div style={{fontSize: '0.75rem', opacity: 0.5, marginTop: '2rem'}}>
            &copy; {new Date().getFullYear()} SecureChat Protocol. All data encrypted.
          </div>
        </div>
      </footer>
    </div>
  );
}
