import { ShieldAlert, LogOut } from 'lucide-react';
import './AlertModal.css';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", danger = true }) {
  if (!isOpen) return null;

  return (
    <div className="alert-modal-overlay animate-fade-in">
      <div className="alert-modal-content">
        <div className="alert-icon-wrapper" data-type={danger ? 'error' : 'info'}>
          {danger ? <ShieldAlert size={40} /> : <LogOut size={40} />}
        </div>
        
        <h3 className="alert-title">{title}</h3>
        <p className="alert-message">{message}</p>
        
        <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
            {cancelText}
          </button>
          <button className={`btn-primary ${danger ? 'danger-btn' : ''}`} onClick={onConfirm} style={{ flex: 1, background: danger ? 'var(--danger)' : 'var(--accent-primary)' }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
