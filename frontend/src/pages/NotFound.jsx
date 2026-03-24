import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
         <ThemeToggle />
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        <ShieldAlert size={80} color="var(--danger)" style={{ marginBottom: '2rem' }} />
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>404 - URL Not Found</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '2.5rem' }}>
          The secure tunnel you are trying to reach does not exist or has been permanently evaporated. 
          Please return to known sectors.
        </p>
        <Link to="/" style={{ padding: '1rem 2rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '8px', fontWeight: 'bold', textDecoration: 'none' }}>
          Return to Dashboard
        </Link>
      </main>
    </div>
  );
}
