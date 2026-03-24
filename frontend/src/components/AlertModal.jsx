import { ShieldAlert, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import './AlertModal.css';

export default function AlertModal({ isOpen, title, message, type = 'info', onClose }) {
  if (!isOpen) return null;

  return (
    <div className="alert-modal-overlay animate-fade-in">
      <div className="alert-modal-content">
        <div className="alert-icon-wrapper" data-type={type}>
          {type === 'error' && <ShieldAlert size={40} />}
          {type === 'warning' && <AlertTriangle size={40} />}
          {type === 'info' && <Info size={40} />}
          {type === 'success' && <CheckCircle size={40} />}
        </div>
        
        <h3 className="alert-title">{title}</h3>
        <p className="alert-message">{message}</p>
        
        <button className="btn-cyber alert-btn" onClick={onClose} autoFocus>
          Acknowledge
        </button>
      </div>
    </div>
  );
}
