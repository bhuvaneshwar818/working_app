import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCcw } from 'lucide-react';

export default function ProfileCropper({ imageSrc, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        1,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  }

  async function getCroppedImg() {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    
    // Set canvas to 300x300 as per our previous optimization requirement
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      300,
      300
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  const handleConfirm = async () => {
    const croppedBase64 = await getCroppedImg();
    onCropComplete(croppedBase64);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', 
      alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div className="glass-panel animate-scale-in" style={{
        padding: '2rem', borderRadius: '20px', width: '95%', maxWidth: '600px', 
        display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-primary)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid var(--border)'
      }}>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
           <h3 style={{color:'white', margin: 0, fontSize: '1.25rem', fontWeight: 800}}>CROP IDENTITY BADGE</h3>
           <button onClick={onCancel} style={{background: 'rgba(255,255,255,0.05)', border:'none', color:'var(--text-secondary)', borderRadius: '50%', padding: '8px', cursor: 'pointer'}}>
             <X size={20} />
           </button>
        </div>

        <div style={{
           width: '100%', maxHeight: '60vh', overflow: 'hidden', 
           display: 'flex', justifyContent: 'center', background: '#000', borderRadius: '12px',
           border: '1px solid var(--border)'
        }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
          >
            <img 
               ref={imgRef}
               src={imageSrc} 
               onLoad={onImageLoad}
               style={{ maxWidth: '100%', maxHeight: '60vh' }} 
               alt="Source"
            />
          </ReactCrop>
        </div>

        <div style={{display: 'flex', gap: '1rem'}}>
           <button onClick={onCancel} className="btn-secondary" style={{flex: 1, padding: '0.85rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              <RotateCcw size={18} /> DISCARD
           </button>
           <button onClick={handleConfirm} className="btn-primary" style={{flex: 1, padding: '0.85rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white'}}>
              <Check size={18} /> CONFIRM BADGE
           </button>
        </div>
        
        <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center'}}>
           Identity will be downscaled to a secure 300x300px thumbnail for maximum network performance.
        </p>
      </div>
    </div>
  );
}
