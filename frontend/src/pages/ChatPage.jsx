import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Shield, Send, ArrowLeft, Lock, Mic, Square, Paperclip, Trash2, Camera, Check, CheckCheck, MoreVertical, Pin, CornerUpLeft, Smile, Flame } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import CameraCropper from '../components/CameraCropper';
import { useToast } from '../context/ToastContext';
import './ChatPage.css';

export default function ChatPage() {
  const { chatRequestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const peerName = location.state?.peerName || 'Secure Comm Link';
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
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const timerIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);

  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if(!peerName || peerName === 'Secure Comm Link') return;
    api.get(`/users/${peerName}/public`).then(res => {
      if(res.data.profilePicture) setPeerAvatar(res.data.profilePicture);
    }).catch(e => console.log('Peer has no public avatar or restricted'));
  }, [peerName]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch chat history
  useEffect(() => {
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/messages/${chatRequestId}`);
        setMessages(res.data);
      } catch (err) {
        console.error('Failed to fetch chat history', err);
      }
    };
    fetchHistory();
  }, [chatRequestId, token]);

  // Connect WebSocket
  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws`),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      debug: () => {},
      onConnect: () => {
        setIsConnected(true);
        // Subscribe to the chat room topic
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
            
            // Send read receipt if it's from peer and not yet SEEN
            if (body.senderUsername && body.senderUsername !== username && body.status !== 'SEEN') {
               client.publish({
                 destination: '/app/chat.markRead',
                 body: JSON.stringify({ chatRequestId })
               });
            }
          }
        });
      },
      onStompError: (frame) => {
        console.error('Broker error:', frame.headers['message']);
      }
    });

    client.activate();
    setStompClient(client);

    return () => {
      // Ephemeral wipe: When leaving the chat, tell the server to clear any seen messages that should evaporate
      if (token && chatRequestId) {
        api.post(`/messages/${chatRequestId}/wipe-seen`).catch(() => {});
      }
    };
  }, [chatRequestId, token]);

  const [isEvaporateMode, setIsEvaporateMode] = useState(false);

  const sendMessage = (e) => {
    e.preventDefault();
    if (audioBlobPreview && stompClient && isConnected) {
       sendMediaMessage(audioBlobPreview, 'AUDIO');
       setAudioBlobPreview(null);
       return;
    }

    if (messageInput.trim() && stompClient && isConnected) {
      const payload = {
        chatRequestId: chatRequestId,
        content: messageInput,
        type: 'TEXT',
        evaporateTime: isEvaporateMode ? 5 : null 
      };

      stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(payload)
      });
      
      setMessageInput('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

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
        reader.onloadend = () => {
           setAudioBlobPreview(reader.result);
        };
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
      setAudioBlobPreview(null);
      
      timerIntervalRef.current = setInterval(() => {
         setAudioTimer(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Microphone access denied", err);
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

  const discardAudio = () => {
     setAudioBlobPreview(null);
     setAudioTimer(0);
  };
  
  const formatTime = (seconds) => {
     const m = Math.floor(seconds / 60).toString().padStart(2, '0');
     const s = (seconds % 60).toString().padStart(2, '0');
     return `${m}:${s}`;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          toast.error("Image is too large. Limit is 5MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        sendMediaMessage(reader.result, 'IMAGE');
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMediaMessage = (base64, type) => {
    if (stompClient && isConnected) {
      const payload = {
        chatRequestId: chatRequestId,
        content: base64,
        type: type,
        evaporateTime: isEvaporateMode ? 5 : null
      };
      stompClient.publish({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify(payload)
      });
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header glass-panel">
        <button onClick={() => navigate('/dashboard')} className="btn-icon back-btn">
          <ArrowLeft size={20} />
        </button>
        <div className="chat-title">
          {peerAvatar ? (
             <img src={peerAvatar} alt="Peer Avatar" style={{width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover'}} />
          ) : (
             <Shield color="var(--accent-primary)" size={20} />
          )}
          <h2 style={{textTransform: 'capitalize'}}>{peerName}</h2>
        </div>
        <div className="status-indicator" style={{display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
          <ThemeToggle />
        </div>
      </header>

      <div className="messages-area glass-panel" onClick={() => setActiveMessageOptions(null)}>
        <div className="encryption-notice">
          <Lock size={14} /> Messages are secured and passed through the Gatekeeper Protocol
        </div>
        
        {messages.length === 0 ? (
          <div className="empty-chat animate-fade-in">
            <Shield size={64} className="faded-icon" />
            <h3>Secure Channel Established</h3>
            <p>You can now communicate securely. Say hello.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderUsername === username;
            return (
              <div key={index} className={`message-wrapper ${isMe ? 'message-right' : 'message-left'} animate-fade-in`} style={{animationDelay: '0s'}}>
                {!isMe && <div className="message-sender">{msg.senderUsername}</div>}
                <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-them'}`} style={{padding: msg.messageType === 'IMAGE' ? '0.5rem' : '', position: 'relative'}} onContextMenu={(e) => { e.preventDefault(); setActiveMessageOptions(msg.id); }}>
                  {msg.messageType === 'IMAGE' ? (
                     <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                       {msg.content?.includes('{"image":') ? (
                          <>
                            <img src={JSON.parse(msg.content).image} style={{maxWidth: '250px', borderRadius: '12px'}} alt="sent-image" />
                            {JSON.parse(msg.content).text && <span style={{fontSize:'0.9rem', padding:'0 0.25rem', paddingBottom: '0.25rem'}}>{JSON.parse(msg.content).text}</span>}
                          </>
                       ) : (
                          <img src={msg.content} style={{maxWidth: '250px', borderRadius: '12px'}} alt="sent-image" />
                       )}
                     </div>
                  ) : msg.messageType === 'AUDIO' ? (
                     <audio src={msg.content} controls style={{height: '40px', outline: 'none', maxWidth: '250px'}} />
                  ) : (
                     msg.content
                  )}
                  {activeMessageOptions === msg.id && (
                     <div className="message-options-menu glass-panel" style={{position: 'absolute', top: 0, [isMe ? 'right' : 'left']: '100%', margin: '0 0.5rem', display: 'flex', flexDirection: 'column', padding: '0.25rem', borderRadius: '8px', zIndex: 10}}>
                         <button className="btn-icon" title="React"><Smile size={16} /></button>
                         <button className="btn-icon" title="Reply"><CornerUpLeft size={16} /></button>
                         <button className="btn-icon danger" title="Delete" onClick={(e) => { e.stopPropagation(); setMessages(messages.filter(m => m.id !== msg.id)); setActiveMessageOptions(null); }}><Trash2 size={16} /></button>
                     </div>
                  )}
                </div>
                <div className="message-meta" style={{display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                  {isMe && (
                     msg.status === 'SEEN' ? <CheckCheck size={14} color="#3b82f6" /> :
                     msg.status === 'DELIVERED' ? <CheckCheck size={14} color="var(--text-secondary)" /> :
                     <Check size={14} color="var(--text-secondary)" />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area glass-panel" onSubmit={sendMessage} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative'}}>
        {!isRecording && !audioBlobPreview && (
            <div style={{display: 'flex', gap: '0.25rem'}}>
                <button type="button" onClick={() => setIsEvaporateMode(!isEvaporateMode)} className="btn-icon" style={{padding: '10px', background: isEvaporateMode ? 'var(--danger)' : 'transparent', color: isEvaporateMode ? 'white' : 'inherit', borderRadius: '8px'}} title={isEvaporateMode ? "Evaporation Mode ACTIVE" : "Enable Evaporation"}>
                   <Flame size={18} />
                </button>
                <button type="button" onClick={() => setShowCameraMode(true)} className="btn-icon" style={{padding: '10px'}} title="Camera Capture" disabled={!isConnected}>
                   <Camera size={18} />
                </button>
                <label className="btn-icon" style={{cursor: 'pointer', padding: '10px'}} title="Upload Photo">
                   <Paperclip size={18} />
                   <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleImageUpload} disabled={!isConnected} />
                </label>
            </div>
        )}
        
        {isRecording ? (
           <button type="button" onClick={stopRecording} className="btn-icon blinking-mic" style={{color: 'var(--danger)', display: 'flex', alignItems: 'center', padding: '10px'}} title="Stop Recording">
              <Mic size={18} />
           </button>
        ) : !audioBlobPreview ? (
           <button type="button" onClick={startRecording} className="btn-icon" style={{padding: '10px'}} title="Record Audio" disabled={!isConnected}>
              <Mic size={18} />
           </button>
        ) : null}

        {isRecording && (
           <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
              <div style={{display: 'flex', gap: '4px', alignItems: 'center', height: '24px'}}>
                 {audioBands.map((h, i) => (
                    <div key={i} style={{
                       width: '4px', background: 'var(--accent-primary)', borderRadius: '4px',
                       height: `${h}px`, transition: 'height 50ms ease'
                    }}></div>
                 ))}
              </div>
              <span style={{fontFamily: 'monospace', color: 'var(--danger)', fontWeight: 'bold'}}>{formatTime(audioTimer)}</span>
              <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', marginLeft: 'auto', paddingRight: '1rem'}}>Tap mic to finish...</span>
           </div>
        )}
        
        {audioBlobPreview && (
           <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
              <button type="button" onClick={discardAudio} className="btn-icon" style={{color: 'var(--text-secondary)'}} title="Discard Recording">
                 <Trash2 size={18} />
              </button>
              <audio src={audioBlobPreview} controls style={{height: '35px', flex: 1, outline: 'none'}} />
           </div>
        )}

        {!isRecording && !audioBlobPreview && (
            <input 
              type="text" 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Transmit a secure message..."
              disabled={!isConnected}
              style={{flex: 1}}
            />
        )}
        <button type="submit" className="btn-primary send-btn" disabled={(!messageInput.trim() && !audioBlobPreview) || !isConnected || isRecording}>
          <Send size={18} />
        </button>
      </form>

      {showCameraMode && (
         <CameraCropper 
            onClose={() => setShowCameraMode(false)} 
            onSend={(packedPayload) => {
               sendMediaMessage(packedPayload, 'IMAGE');
               setShowCameraMode(false);
            }} 
         />
      )}
    </div>
  );
}
