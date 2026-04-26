import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Shield, Send, Lock, Mic, Square, Paperclip, Trash2, Camera, Check, CheckCheck, Smile, CornerUpLeft, ArrowLeft, MoreVertical, Pin, PinOff } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import CameraCropper from '../components/CameraCropper';
import ConfirmModal from './ConfirmModal';
import { useToast } from '../context/ToastContext';
import '../pages/ChatPage.css';

export default function ChatWindow({ peerName: initialPeerName, onBack }) {
  const { chatRequestId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [peerName, setPeerName] = useState(initialPeerName || 'Secure Comm Link');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [activeMessageOptions, setActiveMessageOptions] = useState(null);
  const [stompClient, setStompClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerAvatar, setPeerAvatar] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioTimer, setAudioTimer] = useState(0);
  const [audioBlobPreview, setAudioBlobPreview] = useState(null);
  const [showCameraMode, setShowCameraMode] = useState(false);
  const [audioBands, setAudioBands] = useState([8, 8, 8, 8, 8]);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null });
  const [isPinned, setIsPinned] = useState(false);


  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);

  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if(!chatRequestId) return;
    // Fetch peer name if not provided
    api.get(`/requests/active`).then(res => {
      const chat = res.data.find(c => c.id === chatRequestId);
      if (chat) {
        const name = chat.senderUsername === username ? chat.receiverUsername : chat.senderUsername;
        setPeerName(name);
        setIsPinned(chat.isPinned);
      }
    });
  }, [chatRequestId, username]);


  useEffect(() => {
    if(!peerName || peerName === 'Secure Comm Link') return;
    api.get(`/users/${peerName}/public`).then(res => {
      if(res.data.profilePicture) setPeerAvatar(res.data.profilePicture);
    }).catch(e => console.log('Peer profile pic error'));
  }, [peerName]);

  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoadRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        isInitialLoadRef.current = false;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!token || !chatRequestId) return;
    isInitialLoadRef.current = true; // reset for new chat
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/messages/${chatRequestId}`);
        setMessages(res.data);
      } catch (err) {
        console.error('History fetch failed', err);
      }
    };
    fetchHistory();
  }, [chatRequestId, token]);

  useEffect(() => {
    if (!token || !chatRequestId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`https://securechat-backend-ys13.onrender.com/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: () => {},
      onConnect: () => {
        setIsConnected(true);
        client.subscribe(`/topic/chat/${chatRequestId}`, (msg) => {
          if (msg.body) {
            const body = JSON.parse(msg.body);
            setMessages((prev) => {
              const existingIdx = prev.findIndex(m => m.id === body.id);
              if (existingIdx !== -1) {
                  const newMessages = [...prev];
                  newMessages[existingIdx] = body;
                  return newMessages;
              }
              return [...prev, body];
            });
            
            if (body.senderUsername && body.senderUsername !== username && body.status !== 'SEEN') {
               client.publish({
                 destination: '/app/chat.markRead',
                 body: JSON.stringify({ chatRequestId })
               });
            }
          }
        });
      }
    });

    client.activate();
    setStompClient(client);

    return () => {
      client.deactivate();
    };
  }, [chatRequestId, token, username]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (audioBlobPreview && stompClient && isConnected) {
       sendMediaMessage(audioBlobPreview, 'AUDIO');
       setAudioBlobPreview(null);
       return;
    }
    if (messageInput.trim() && stompClient && isConnected) {
      stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify({ chatRequestId, content: messageInput, type: 'TEXT' })
      });
      setMessageInput('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
         await audioCtx.resume();
      }
      
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      const updatePitch = () => {
         if(!analyserRef.current) return;
         analyserRef.current.getByteFrequencyData(dataArrayRef.current);
         const getH = (idx) => Math.floor((dataArrayRef.current[idx] / 255) * 16) + 8;
         setAudioBands([getH(0), getH(2), getH(4), getH(6), getH(8)]);
         animationFrameRef.current = requestAnimationFrame(updatePitch);
      };
      updatePitch();

      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => setAudioBlobPreview(reader.result);
        stream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(()=>{});
        }
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioTimer(0);
      timerIntervalRef.current = setInterval(() => setAudioTimer(p => p + 1), 1000);
    } catch (e) { 
      console.error(e);
      toast.error("Microphone access blocked. Ensure browser permissions are allowed."); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      clearInterval(timerIntervalRef.current);
    }
  };

  const discardAudio = () => { setAudioBlobPreview(null); setAudioTimer(0); };
  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const sendMediaMessage = (base64, type) => {
    if (stompClient && isConnected) {
      stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify({ chatRequestId, content: base64, type })
      });
    }
  };

  const deleteConnection = () => {
    setConfirmModal({ isOpen: true, type: 'DELETE' });
  };

  const reportTrustIssue = () => {
    setConfirmModal({ isOpen: true, type: 'TRUST_ISSUE' });
  };

  const confirmAction = async () => {
    try {
        if (confirmModal.type === 'DELETE') {
            await api.delete(`/requests/${chatRequestId}`);
            toast.success("Connection terminated successfully.");
        } else {
            await api.delete(`/requests/${chatRequestId}/trust-issue`);
            toast.info("Trust issue reported and link terminated.");
        }
        setConfirmModal({ isOpen: false, type: null });
        if (onBack) onBack(); else navigate('/dashboard');
    } catch (err) {
        toast.error("Action failed.");
    }
  };

  const togglePin = async () => {
    try {
      await api.post(`/requests/${chatRequestId}/pin`);
      setIsPinned(!isPinned);
      setShowMenu(false);
      toast.success(isPinned ? "Chat unpinned" : "Chat pinned");
    } catch (err) {
      toast.error("Failed to pin/unpin chat.");
    }
  };

  return (
    <div className="chat-container" style={{height: '100%', borderRadius: '12px', display: 'flex', flexDirection: 'column'}}>
      <header className="chat-header glass-panel" style={{borderRadius: '0', position: 'relative', zIndex: 1000, flexShrink: 0}}>
        {onBack && (
          <button onClick={onBack} className="btn-icon back-btn">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="chat-title">
          {peerAvatar ? <img src={peerAvatar} alt="Avatar" style={{width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover'}} /> : <Shield color="var(--accent-primary)" size={24} />}
          <h2 style={{textTransform: 'capitalize'}}>{peerName}</h2>
        </div>
        <div className="chat-header-actions" style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px'}}>
          <ThemeToggle />
          <div style={{position: 'relative'}}>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
              className="btn-icon"
              style={{background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}
            >
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <div 
                className="glass-panel" 
                style={{
                  position: 'absolute', 
                  top: 'calc(100% + 10px)', 
                  right: 0, 
                  zIndex: 2000, 
                  minWidth: '200px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  overflow: 'hidden', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border)', 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  padding: '5px'
                }}
              >
                <button 
                  style={{padding: '12px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px'}}
                  onClick={togglePin}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  {isPinned ? <><PinOff size={16} /> Unpin Chat</> : <><Pin size={16} /> Pin Chat</>}
                </button>
                <button 
                  style={{padding: '12px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px'}}
                  onClick={() => { setShowMenu(false); deleteConnection(); }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <Trash2 size={16} /> Disconnect
                </button>
                <button 
                  style={{padding: '12px 16px', background: 'transparent', border: 'none', color: 'var(--danger)', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px'}}
                  onClick={() => { setShowMenu(false); reportTrustIssue(); }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <Shield size={16} /> Report Trust Issue
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      <div className="messages-area glass-panel" style={{borderRadius: '0'}} onClick={() => setActiveMessageOptions(null)}>
        {messages.length === 0 ? (
          <div className="empty-chat animate-fade-in" style={{marginTop:'auto', marginBottom:'auto'}}>
            <Shield size={64} className="faded-icon" />
            <h3>Secure Channel Established</h3>
            <p>You can now communicate securely.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderUsername && username && msg.senderUsername.toLowerCase() === username.toLowerCase();
            return (
              <div key={i} className={`message-wrapper ${isMe ? 'message-right' : 'message-left'} animate-fade-in`}>
                <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-them'}`} style={{position: 'relative'}} onContextMenu={(e) => { e.preventDefault(); setActiveMessageOptions(msg.id); }}>
                  {msg.messageType === 'IMAGE' ? <img src={msg.content.includes('{"image"') ? JSON.parse(msg.content).image : msg.content} style={{maxWidth: '250px', borderRadius: '12px'}} alt="media" /> : 
                   msg.messageType === 'AUDIO' ? <audio src={msg.content} controls style={{height: '40px', maxWidth: '250px'}} /> : msg.content}
                   {activeMessageOptions === msg.id && (
                     <div className="message-options-menu glass-panel" style={{position: 'absolute', top: 0, [isMe ? 'right' : 'left']: '100%', margin: '0 0.5rem', display: 'flex', gap: '5px', padding: '5px', zIndex: 100}}>
                        <button className="btn-icon" onClick={() => setMessages(messages.filter(m => m.id !== msg.id))}><Trash2 size={16} /></button>
                     </div>
                   )}
                </div>
                <div className="message-meta" style={{display: 'flex', alignItems: 'center', gap: '4px', justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMe && (msg.status === 'SEEN' ? <CheckCheck size={14} color="#3b82f6" /> : <Check size={14} color="var(--text-secondary)" />)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area glass-panel" onSubmit={sendMessage} style={{borderRadius: '0', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)'}}>
        {!isRecording && !audioBlobPreview && (
            <div className="chat-input-actions" style={{display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0, justifyContent: 'flex-start'}}>
                <button type="button" onClick={() => setShowCameraMode(true)} className="btn-icon" style={{background: 'rgba(255,255,255,0.05)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'var(--text-primary)'}} title="Camera Capture" disabled={!isConnected}>
                   <Camera size={18} />
                </button>
                <label className="btn-icon" style={{cursor: 'pointer', background: 'rgba(255,255,255,0.05)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'var(--text-primary)'}} title="Upload Photo">
                   <Paperclip size={18} />
                   <input 
                     type="file" 
                     accept="image/*" 
                     style={{display: 'none'}} 
                     onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => sendMediaMessage(reader.result, 'IMAGE');
                          reader.readAsDataURL(file);
                        }
                     }} 
                     disabled={!isConnected} 
                   />
                </label>

                {isRecording ? (
                   <button type="button" onClick={stopRecording} className="btn-icon blinking-mic" style={{color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none'}} title="Stop Recording">
                      <Mic size={18} />
                   </button>
                ) : !audioBlobPreview ? (
                   <button type="button" onClick={startRecording} className="btn-icon" style={{background: 'rgba(255,255,255,0.05)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'var(--text-primary)'}} title="Record Audio" disabled={!isConnected}>
                      <Mic size={18} />
                   </button>
                ) : null}
            </div>
        )}

        <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%'}}>
            {!isRecording && !audioBlobPreview && (
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Transmit a secure message..."
                  disabled={!isConnected}
                  style={{flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.75rem 1.25rem', borderRadius: '24px', color: 'white', fontSize: '0.95rem'}}
                />
            )}

            {isRecording && (
               <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                  <div style={{display: 'flex', gap: '4px', alignItems: 'center', height: '20px'}}>
                     {audioBands.map((h, i) => (
                        <div key={i} style={{ width: '3px', background: 'var(--accent-primary)', borderRadius: '3px', height: `${h}px` }}></div>
                     ))}
                  </div>
                  <span style={{color: 'var(--danger)', fontWeight: 'bold'}}>{formatTime(audioTimer)}</span>
               </div>
            )}
            
            {audioBlobPreview && (
               <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                  <button type="button" onClick={discardAudio} className="btn-icon"><Trash2 size={18} /></button>
                  <audio src={audioBlobPreview} controls style={{height: '35px', flex: 1}} />
               </div>
            )}

            <button type="submit" className="btn-primary send-btn" style={{width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', flexShrink: 0}} disabled={(!messageInput.trim() && !audioBlobPreview) || !isConnected || isRecording}>
              <Send size={18} />
            </button>
        </div>
      </form>

      {showCameraMode && <CameraCropper onClose={() => setShowCameraMode(false)} onSend={p => { sendMediaMessage(p, 'IMAGE'); setShowCameraMode(false); }} />}
      
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'DELETE' ? "Terminate Link?" : "Report Trust Issue?"}
        message={confirmModal.type === 'DELETE' 
          ? `Disconnect from ${peerName}? All transmission history will be permanently deleted.` 
          : `Report a security breach/trust issue with ${peerName}? This connection was terminated and their trust score will be penalized.`}
        confirmText={confirmModal.type === 'DELETE' ? "Terminate" : "Report & Terminate"}
        onConfirm={confirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: null })}
      />
    </div>
  );
}
