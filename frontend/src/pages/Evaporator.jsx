import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Shield, Send, Zap, ArrowLeft, Anchor, Lock, Mic, Square, Paperclip, Trash2, Camera } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import CameraCropper from '../components/CameraCropper';
import './DarkRoom.css';
import './ChatPage.css';

export default function Evaporator() {
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [activeChats, setActiveChats] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [roomHash, setRoomHash] = useState('');
  const [peerName, setPeerName] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [stompClient, setStompClient] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioTimer, setAudioTimer] = useState(0);
  const [audioBlobPreview, setAudioBlobPreview] = useState(null);
  const [showCameraMode, setShowCameraMode] = useState(false);
  const [evaporateTime, setEvaporateTime] = useState(() => Number(localStorage.getItem('evaporateTime')) || 30);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (view === 'list') {
      api.get('/requests/active').then(res => setActiveChats(res.data)).catch(console.error);
      api.get('/users/online').then(res => setOnlineUsers(res.data)).catch(console.error);
      api.get('/evaporator/unread-counts').then(res => {
         if (res.data) setUnreadCounts(res.data);
      }).catch(console.error);
    }
  }, [view]);

  // Handle in-memory unread counts for volatile messages
  useEffect(() => {
    let client = null;
    if (token && view === 'list') {
       client = new Client({
          webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws`),
          connectHeaders: { Authorization: `Bearer ${token}` },
          onConnect: () => {
             client.subscribe('/user/queue/updates', (msg) => {
                if (msg.body.startsWith('NEW_EVAP_MESSAGE:')) {
                   const sender = msg.body.split(':')[1];
                   setUnreadCounts(prev => ({
                      ...prev,
                      [sender]: (prev[sender] || 0) + 1
                   }));
                }
             });
          }
       });
       client.activate();
    }
    return () => { if(client) client.deactivate(); };
  }, [token, view]);

  const joinEvaporator = (peer) => {
    setPeerName(peer);
    setUnreadCounts(prev => ({...prev, [peer]: 0}));
    
    // Fetch and instantly vaporize messages from the separate DB table
    api.get(`/evaporator/messages/${peer}`).then(res => {
       setMessages(res.data);
       res.data.forEach(msg => {
          if (msg.evaporateTime && msg.senderUsername === username) {
             setTimeout(() => removeMessageLocally(msg.id), msg.evaporateTime * 1000);
          }
       });
    }).catch(console.error);

    const hash = [username, peer].sort().join('-evap-');
    setRoomHash(hash);
    setView('chat');
    
    const client = new Client({
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: () => {},
      onConnect: () => {
        client.subscribe(`/topic/evaporator/${hash}`, (msg) => {
          if (msg.body) {
            const body = JSON.parse(msg.body);
            setMessages((prev) => [...prev, body]);
            if (body.evaporateTime && body.senderUsername === username) {
               setTimeout(() => removeMessageLocally(body.id), body.evaporateTime * 1000);
            }
          }
        });
      },
    });

    client.activate();
    setStompClient(client);
  };

  const removeMessageLocally = (id) => {
     setMessages((current) => current.filter(m => m.id !== id));
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (audioBlobPreview && stompClient) {
       sendMediaMessage(audioBlobPreview, 'AUDIO');
       setAudioBlobPreview(null);
       return;
    }

    if (messageInput.trim() && stompClient) {
      const tempId = Math.random().toString(36).substr(2, 9);
      const payload = {
        roomId: roomHash,
        content: messageInput,
        id: tempId,
        type: 'TEXT',
        evaporateTime
      };
      
      stompClient.publish({
        destination: '/app/evaporator.sendMessage',
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
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = () => sendMediaMessage(reader.result, 'IMAGE');
      reader.readAsDataURL(file);
    }
  };

  const sendMediaMessage = (base64, type) => {
    if (stompClient) {
      const tempId = Math.random().toString(36).substr(2, 9);
      const payload = {
        roomId: roomHash,
        content: base64,
        id: tempId,
        type: type,
        evaporateTime
      };
      stompClient.publish({
        destination: '/app/evaporator.sendMessage',
        body: JSON.stringify(payload)
      });
    }
  };

  const leaveChat = () => {
    if(stompClient) stompClient.deactivate(); 
    setMessages([]);
    setView('list');
  };

  return (
    <div className="darkroom-container">
      <header className="darkroom-header glass-panel" style={{justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          <button onClick={() => { view === 'chat' ? leaveChat() : navigate('/dashboard'); }} className="btn-icon back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="chat-title" style={{color: 'var(--accent-secondary)'}}>
            <Zap size={24} />
            <h2 style={{textTransform: 'capitalize'}}>{peerName ? peerName : 'Evaporator Protocol'}</h2>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {view === 'list' && (
        <div className="darkroom-dashboard">
          <div className="glass-panel" style={{padding: '2rem', borderRadius: '12px', border: '1px solid rgba(217, 70, 239, 0.2)'}}>
            <h3 style={{color: 'var(--accent-secondary)'}}><Zap size={20}/> Pure Volatile Chat</h3>
            <p style={{color: 'var(--text-secondary)'}}>No security PINs required. Traces dissolve immediately. Choose an active peer to begin.</p>
            
            <div style={{marginTop: '2rem'}}>
              <h4 style={{color: 'var(--text-primary)'}}>Your Active Connections</h4>
              {activeChats.length === 0 && <p style={{color: 'var(--text-secondary)'}}>No active friends found.</p>}
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1rem'}}>
                {activeChats.map(chat => {
                  const peer = chat.senderUsername === username ? chat.receiverUsername : chat.senderUsername;
                  return (
                    <button 
                      key={chat.id} className="btn-secondary" 
                      onClick={() => joinEvaporator(peer)}
                      style={{padding: '1rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}
                    >
                      <div style={{display: 'flex', alignItems: 'center', position: 'relative'}}>
                        {onlineUsers.includes(peer) && (
                           <div 
                             title="Online" 
                             style={{
                               position: 'absolute', top: '-4px', left: '-12px', 
                               width: '10px', height: '10px', borderRadius: '50%', 
                               background: 'var(--success)', 
                               boxShadow: '0 0 8px var(--success)',
                               border: '2px solid var(--bg-secondary)'
                             }} 
                           />
                        )}
                        <span style={{lineHeight: '1'}}>Evaporate with: {peer}</span>
                      </div>
                      {(unreadCounts[peer] || 0) > 0 && <span style={{background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'}}>{unreadCounts[peer]}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'chat' && (
        <div className="darkroom-chat-view" style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0}}>
          <div className="messages-area glass-panel darkroom-messages" style={{flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(217, 70, 239, 0.2)', padding: '1rem', display: 'flex', flexDirection: 'column'}}>
            <div className="encryption-notice" style={{color: 'var(--accent-secondary)', borderColor: 'rgba(217, 70, 239, 0.2)', background: 'rgba(217, 70, 239, 0.05)'}}>
              <Zap size={14} /> EPHEMERAL MODE ACTIVE - CLICK A MESSAGE TO INSTANTLY VAPORIZE IT
            </div>
            
            {messages.length === 0 ? (
              <div className="empty-chat animate-fade-in" style={{textAlign: 'center', marginTop: '2rem'}}>
                <Zap size={64} style={{color: 'var(--accent-secondary)', opacity: 0.5, marginBottom: '1rem'}} />
                <h3 style={{color: 'white'}}>Ghosts in the shell</h3>
                <p style={{color: 'var(--text-secondary)'}}>Start typing. Traces are wiped from existence when you close the app or click them.</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.senderUsername === username;
                return (
                  <div key={msg.id || index} onClick={() => removeMessageLocally(msg.id)} style={{cursor: 'pointer'}} title="Click to Vaporize" className={`message-wrapper ${isMe ? 'message-right' : 'message-left'} animate-fade-in`}>
                    {!isMe && <div className="message-sender" style={{color: 'var(--text-secondary)'}}>{msg.senderUsername}</div>}
            <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-them'}`} style={Object.assign({padding: msg.messageType === 'IMAGE' ? '0.5rem' : ''})}>
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
            </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={sendMessage} style={{flexShrink: 0, border: '1px solid rgba(255, 62, 62, 0.2)', background:'var(--bg-color)', padding:'0.75rem 1rem', display:'flex', gap:'0.75rem', borderRadius: '12px', marginTop: '1rem', alignItems: 'center'}}>
            
        {!isRecording && !audioBlobPreview && (
            <div style={{display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0}}>
                <span style={{background: 'rgba(255,0,0,0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 62, 62, 0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap', lineHeight: '1', display: 'inline-flex', alignItems: 'center', height: '28px'}} title="Evaporation delay (change in Settings)">{evaporateTime}s</span>
                <button type="button" onClick={() => setShowCameraMode(true)} style={{color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', height: '28px'}} title="Camera Capture" disabled={!stompClient}>
                   <Camera size={20} />
                </button>
                <label style={{cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', height: '28px'}} title="Upload Secure Image">
                   <Paperclip size={20} />
                   <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleImageUpload} disabled={!stompClient} />
                </label>
                <button type="button" onClick={startRecording} style={{color: 'var(--accent-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', height: '28px'}} title="Record Volatile Audio">
                   <Mic size={20} />
                </button>
            </div>
        )}

            {isRecording && (
               <button type="button" onClick={stopRecording} className="blinking-mic" style={{color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', flexShrink: 0}} title="Stop Recording">
                  <Mic size={20} />
               </button>
            )}

            {isRecording && (
           <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
              <div style={{display: 'flex', gap: '4px', alignItems: 'center', height: '24px'}}>
                 {audioBands.map((h, i) => (
                    <div key={i} style={{width: '4px', background: 'var(--danger)', borderRadius: '4px', height: `${h}px`, transition: 'height 50ms ease'}}></div>
                 ))}
              </div>
              <span style={{fontFamily: 'monospace', color: 'var(--danger)', fontWeight: 'bold'}}>{formatTime(audioTimer)}</span>
              <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', marginLeft: 'auto', paddingRight: '1rem'}}>Tap mic to finalize...</span>
           </div>
        )}

            {audioBlobPreview && (
               <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                  <button type="button" onClick={discardAudio} style={{color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center'}} title="Discard Recording">
                     <Trash2 size={20} />
                  </button>
                  <audio src={audioBlobPreview} controls style={{height: '35px', flex: 1, outline: 'none'}} />
               </div>
            )}

            {!isRecording && !audioBlobPreview && (
                <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Transmit untraceable data..." style={{flex: 1, background: 'transparent', border:'none', color:'var(--text-primary)', fontSize: '1rem', height: '28px', padding: 0}} />
            )}
            
            <button type="submit" className="btn-cyber" style={{padding: '0.5rem 1rem', background: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}} disabled={(!messageInput.trim() && !audioBlobPreview) || isRecording}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

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
