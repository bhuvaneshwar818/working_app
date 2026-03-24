import React, { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera, X, Check, RefreshCw } from 'lucide-react';

export default function CameraCropper({ onClose, onSend }) {
  const [stream, setStream] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [note, setNote] = useState('');
  
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const streamRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // If the user closed the modal before this finished, stop it immediately!
      if (!isMountedRef.current) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    setStream(null);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      const w = videoRef.current.videoWidth || 1280;
      const h = videoRef.current.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      setImageSrc(canvas.toDataURL('image/jpeg'));
      stopCamera();
    }
  };

  const retakePhoto = () => {
    stopCamera();
    setImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(null);
    startCamera();
  };

  const getCroppedImg = async () => {
    if (!completedCrop || !completedCrop.width || !completedCrop.height || !imgRef.current) {
       return imageSrc; // if not cropped, just send original
    }
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );
    return canvas.toDataURL('image/jpeg');
  };

  const handleSend = async () => {
    const finalImage = await getCroppedImg();
    const packed = JSON.stringify({ image: finalImage, text: note });
    onSend(packed); // Hand off packed payload
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', 
      alignItems: 'center', justifyContent: 'center', padding: '2rem'
    }}>
      <div className="glass-panel" style={{
        padding: '1.5rem', borderRadius: '12px', width: '95%', maxWidth: '900px', 
        display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
           <h3 style={{color:'white', display:'flex', alignItems:'center', gap:'0.5rem', margin: 0, fontSize: '1.5rem'}}>
              <Camera size={24} color="var(--accent-primary)"/> Secure Camera Workstation
           </h3>
           <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', padding: '0.5rem'}}>
             <X size={24} />
           </button>
        </div>

        {!imageSrc ? (
          <div style={{position: 'relative', width: '100%', minHeight: '400px', borderRadius: '8px', overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                onLoadedMetadata={() => videoRef.current.play()}
                style={{width: '100%', height: '100%', minHeight: '400px', objectFit: 'cover', display: 'block'}} 
             />
             <div style={{position: 'absolute', bottom: '1.5rem', left: 0, width: '100%', display: 'flex', justifyContent: 'center'}}>
                <button onClick={capturePhoto} className="btn-primary" style={{
                   padding: '1rem 3rem', borderRadius: '50px', background: 'var(--accent-primary)',
                   border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
                   boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}>Capture Frame</button>
             </div>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
             <div style={{maxHeight:'50vh', overflow:'hidden', borderRadius:'8px', background:'#000', display:'flex', justifyContent:'center'}}>
               <ReactCrop 
                 crop={crop} 
                 onChange={c => setCrop(c)} 
                 onComplete={c => setCompletedCrop(c)}
                 aspect={undefined}
               >
                 <img ref={imgRef} src={imageSrc} style={{maxWidth:'100%', maxHeight:'50vh', display: 'block'}} alt="Capture"/>
               </ReactCrop>
             </div>
             <button onClick={retakePhoto} className="btn-secondary" style={{display:'flex', justifyContent:'center', gap:'0.5rem', background:'transparent', border:'1px solid var(--border)', padding:'0.5rem', color:'var(--text-secondary)', borderRadius: '8px', cursor: 'pointer'}}>
                <RefreshCw size={16} /> Retake
             </button>
             <input 
               type="text" 
               placeholder="Add a secure caption..." 
               value={note} 
               onChange={e => setNote(e.target.value)} 
               style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', 
                  color: 'white', padding: '0.75rem', borderRadius: '8px', outline: 'none'
               }}
             />
             <button onClick={handleSend} className="btn-primary" style={{display:'flex', justifyContent:'center', alignItems: 'center', gap:'0.5rem', padding:'0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer'}}>
                <Check size={18} /> Encrypt & Send
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
