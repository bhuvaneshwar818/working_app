import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Shield, Send, ArrowLeft, Key, Lock, RadioTower, Mic, Square, Paperclip, Trash2, Camera, ShieldAlert } from 'lucide-react';
import api from '../api';
import './DarkRoom.css';
import './ChatPage.css';
import ThemeToggle from '../components/ThemeToggle';
import CameraCropper from '../components/CameraCropper';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

export default function DarkRoom() {
  const navigate = useNavigate();
  const toast = useToast();
  const [view, setView] = useState('dashboard');
  
  const [rooms, setRooms] = useState([]);
  const [targetUser, setTargetUser] = useState('');
  const [searchResultsArray, setSearchResultsArray] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [tempPin, setTempPin] = useState('');
  const [error, setError] = useState('');
  const [handshakeStatus, setHandshakeStatus] = useState(''); 
  

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
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
  
  // Ref to hold connected stompClient persistently across renders
  const stompClientRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false);
  const [trustRoomId, setTrustRoomId] = useState(null);
  
  // Tracking current active room subscriptions to prevent double-subbing
  const subscriptionsRef = useRef({});

  const messagesEndRef = useRef(null);

  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [onlineUsers, setOnlineUsers] = useState([]);

  const loadRooms = async () => {
    try {
      const res = await api.get('/darkroom/mine');
      setRooms(res.data);
      
      const onlineRes = await api.get('/users/online');
      setOnlineUsers(onlineRes.data);

      const activeRes = await api.get('/requests/active');
      setDashboardConnections(activeRes.data);
    } catch (err) {}
  };

  // 1. Initialize permanent STOMP connection ONCE on mount
  useEffect(() => {
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        setIsConnected(true);
        // Subscribe to global status queue implicitly
        client.subscribe('/user/queue/darkroom-status', (msg) => {
          loadRooms();
          if (msg.body === 'READY') toast.success("Secure Link Established. Vault is tightly sealed and ready.");
          if (msg.body === 'ACCEPTED') toast.info("Peer has locked their encryption key. Finalize the vault now.");
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      }
    });

    client.activate();
    stompClientRef.current = client;

    // We do NOT pull keys on unmount here. We rely on the backend SessionDisconnectEvent natively!
    return () => {
      client.deactivate();
    };
  }, [token]);

  // 2. Manage room subscriptions based strictly on selectedRoom and view
  useEffect(() => {
     if (!isConnected || !stompClientRef.current || !selectedRoom) return;

     const client = stompClientRef.current;
     const statusTopic = `/topic/darkroom-status/${selectedRoom.id}`;
     const chatTopic = `/topic/darkroom/${selectedRoom.id}`;

     // Clear old subscriptions if they exist
     if (subscriptionsRef.current[statusTopic]) subscriptionsRef.current[statusTopic].unsubscribe();
     if (subscriptionsRef.current[chatTopic]) subscriptionsRef.current[chatTopic].unsubscribe();

     // Always subscribe to status when a room is selected
     subscriptionsRef.current[statusTopic] = client.subscribe(statusTopic, (msg) => {
        if (msg.body === 'UNLOCKED') {
           setHandshakeStatus('UNLOCKED');
           setTimeout(() => { 
               setModalType(null); 
               setView('chat'); 
           }, 1000);
        } else if (msg.body === 'COLLAPSED') {
           toast.error("Peer disconnected abruptly. Vault collapsed globally.");
           handleLeaveRoom();
        } else if (msg.body.startsWith('WAITING_FOR_PEER_')) {
           const peer = msg.body.split('WAITING_FOR_PEER_')[1];
           if (peer !== username) {
              toast.warning(`${peer} is waiting locally. Turn your key!`);
           }
        }
     });

     // Only subscribe to chat if view === 'chat'
     if (view === 'chat') {
        subscriptionsRef.current[chatTopic] = client.subscribe(chatTopic, (msg) => {
             const body = JSON.parse(msg.body);
             setMessages((prev) => {
               if (prev.find(m => m.id === body.id)) return prev;
               return [...prev, body];
             });
        });
     }

     return () => {
         if (subscriptionsRef.current[statusTopic]) subscriptionsRef.current[statusTopic].unsubscribe();
         if (subscriptionsRef.current[chatTopic]) subscriptionsRef.current[chatTopic].unsubscribe();
     };
  }, [isConnected, selectedRoom, view]);


  useEffect(() => {
    if (view === 'dashboard') loadRooms();
  }, [view]);

  useEffect(() => {
    if (view === 'chat' && selectedRoom) {
      api.get(`/darkroom/messages/${selectedRoom.id}`)
         .then(res => setMessages(res.data))
         .catch(() => setMessages([]));
    }
  }, [view, selectedRoom]);

  useEffect(() => {
    if (targetUser.trim().length > 0) {
      api.get(`/users/search?q=${targetUser}`)
         .then(res => setSearchResultsArray(res.data))
         .catch(() => setSearchResultsArray([]));
    } else {
      setSearchResultsArray([]);
    }
  }, [targetUser]);

  const sendRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/darkroom/request', { receiverUsername: targetUser });
      setTargetUser(''); loadRooms();
    } catch (err) { setError(err.response?.data?.message); }
  };

  const openModal = (type, room) => {
    setError('');
    setTempPin('');
    setSelectedRoom(room);
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    // DO NOT CLEAR selectedRoom here! It crashes the chat view if they transition to it!
    setTempPin('');
    setError('');
    setHandshakeStatus('');
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!tempPin || tempPin.length !== 4) {
      setError("Exactly 4 digits required.");
      return;
    }

    try {
      if (modalType === 'accept') {
        await api.post(`/darkroom/accept/${selectedRoom.id}`, { pin: tempPin });
        loadRooms(); closeModal(); setSelectedRoom(null); // only clear here because we go back to dashboard
      } else if (modalType === 'finalize') {
        await api.post(`/darkroom/finalize/${selectedRoom.id}`, { pin: tempPin });
        loadRooms(); closeModal(); setSelectedRoom(null); // only clear here
      } else if (modalType === 'unlock') {
        const res = await api.post(`/darkroom/insert-key/${selectedRoom.id}`, { pin: tempPin });
        if (res.data.status === 'WAITING') {
          setHandshakeStatus('waiting');
          setModalType('waiting_peer');
        } else if (res.data.status === 'UNLOCKED') {
          setMessages(res.data.messages || []); 
          setHandshakeStatus('UNLOCKED');
          setTimeout(() => { closeModal(); setView('chat'); }, 1000); // DO NOT CLEAR selectedRoom here!!!
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid Key Sequence");
    }
  };

  const handleLeaveRoom = () => {
      // Explicitly pull key when backing out gracefully.
      if (selectedRoom) api.post(`/darkroom/pull-key/${selectedRoom.id}`).catch(() => {});
      closeModal();
      setSelectedRoom(null);
      setMessages([]);
      setView('dashboard');
  };

  const handleTrustIssue = async () => {
    if (!trustRoomId) return;
    try {
       await api.post(`/darkroom/${trustRoomId}/trust-issue`);
       toast.success("Trust Issue Reported. Vault Collapsed.");
       setIsTrustModalOpen(false);
       setTrustRoomId(null);
       loadRooms();
    } catch (err) {
       toast.error(err.response?.data?.message || "Failed to report trust issue");
    }
  };

  const openTrustModal = (roomId) => {
    setTrustRoomId(roomId);
    setIsTrustModalOpen(true);
  };

  const renderUserRow = (user, uName, isLocked) => (
    <div key={uName} 
      style={{
          padding: '0.75rem 1rem', 
          borderBottom: '1px solid rgba(255,255,255,0.05)', 
          display:'flex', alignItems:'center', justifyContent: 'space-between',
          color: isLocked ? 'var(--text-secondary)' : 'var(--text-primary)',
          opacity: isLocked ? 0.7 : 1,
          background: 'rgba(0, 0, 0, 0.3)'
      }}
    >
       <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
           {user.profilePicture ? (
               <img src={user.profilePicture} alt="Avatar" style={{width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover'}} />
           ) : (
               <Shield size={16} color={isLocked ? 'var(--text-secondary)' : 'var(--accent-primary)'}/> 
           )}
           <div style={{display: 'flex', flexDirection: 'column'}}>
             <span style={{fontWeight: '500'}}>{uName}</span>
           </div>
       </div>
       {isLocked ? (
          <span style={{color: 'var(--danger)', fontSize: '0.8rem'}}>Requests Disabled</span>
       ) : (
          <button 
            className="btn-cyber" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={async (e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              try {
                await api.post('/darkroom/request', { receiverUsername: uName });
                setTargetUser(''); 
                setSearchResultsArray([]); 
                loadRooms();
              } catch (err) { setError(err.response?.data?.message); }
            }}
          >
            <Lock size={14} style={{marginRight: '0.3rem'}}/> Send Classified Ping
          </button>
       )}
    </div>
  );

  const transmitMessage = (e) => {
    e.preventDefault();
    if (audioBlobPreview && stompClientRef.current && isConnected && selectedRoom) {
       sendMediaMessage(audioBlobPreview, 'AUDIO');
       setAudioBlobPreview(null);
       return;
    }

    if (messageInput.trim() && stompClientRef.current && isConnected && selectedRoom) {
      stompClientRef.current.publish({
        destination: '/app/darkroom.sendMessage',
        body: JSON.stringify({ roomId: selectedRoom.id, content: messageInput, type: 'TEXT' })
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
          toast.error("Size Limit Exceeded: Maximum encrypted payload is 5MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => sendMediaMessage(reader.result, 'IMAGE');
      reader.readAsDataURL(file);
    }
  };

  const sendMediaMessage = (base64, type) => {
    if (stompClientRef.current && isConnected && selectedRoom) {
      stompClientRef.current.publish({
        destination: '/app/darkroom.sendMessage',
        body: JSON.stringify({ roomId: selectedRoom.id, content: base64, type })
      });
    }
  };

  return (
    <div className="darkroom-container">
      <header className="darkroom-header glass-panel" style={{justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          <button onClick={() => view === 'chat' ? handleLeaveRoom() : navigate('/dashboard')} className="btn-icon back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="chat-title">
            <Shield size={24} color="var(--accent-primary)" />
            <h2 style={{textTransform: 'capitalize'}}>{selectedRoom ? (selectedRoom.initiatorUsername === username ? selectedRoom.receiverUsername : selectedRoom.initiatorUsername) : 'Dark Room Command'}</h2>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {view === 'dashboard' && (
        <div className="darkroom-dashboard">
           <div className="glass-panel" style={{padding: '2rem', marginBottom: '1.5rem', borderRadius: '12px', position: 'relative', zIndex: 20}}>
             <h3 style={{color: 'var(--accent-primary)', marginBottom: '1rem'}}>Initiate New Secure Connection</h3>
             <form onSubmit={sendRequest} style={{position: 'relative'}}>
               <div style={{display:'flex', gap: '1rem'}}>
                 <input 
                    type="text" 
                    placeholder="Search username in database..." 
                    value={targetUser} 
                    onChange={e=>setTargetUser(e.target.value)} 
                    required 
                    style={{flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white'}}
                 />
               </div>
               {targetUser.trim().length > 0 && searchResultsArray.length > 0 && (
                 <div className="glass-panel" style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>
                    {searchResultsArray.map(user => {
                        const uName = typeof user.username === 'string' ? user.username : user;
                        const isLocked = !user.allowIncomingRequests;
                        return renderUserRow(user, uName, isLocked);
                    })}
                 </div>
               )}
             </form>
           </div>
           
           <div className="rooms-grid">
               {rooms.map(room => {
                   const isMeSender = room.initiatorUsername === username;
                   const peer = isMeSender ? room.receiverUsername : room.initiatorUsername;
                   
                   return (
                     <div key={room.id} className="request-card">
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
                          <div style={{fontWeight: 600, color: 'var(--accent-primary)', fontSize: '1.1rem', lineHeight: '1'}}>Vault: {peer}</div>
                        </div>
                        
                        {room.status === 'PENDING' && isMeSender && <div style={{color:'var(--text-secondary)', fontSize: '0.9rem'}}>Phase 1: Awaiting {peer}'s 4-Digit Genesis Key.</div>}
                        
                        {room.status === 'PENDING' && !isMeSender && (
                          <div style={{marginTop: '0.5rem'}}>
                             <p style={{fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem'}}>Inbound Vault Initialization Request. Generate your Secret Key 1.</p>
                             <button className="btn-cyber" style={{width: '100%'}} onClick={() => openModal('accept', room)}>Lock In Genesis Key</button>
                          </div>
                        )}

                        {room.status === 'ACCEPTED' && !isMeSender && <div style={{color:'var(--text-secondary)', fontSize: '0.9rem'}}>Phase 2: Awaiting {peer}'s 4-Digit Finalization Key.</div>}

                        {room.status === 'ACCEPTED' && isMeSender && (
                           <div style={{marginTop: '0.5rem'}}>
                             <p style={{fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem'}}>{peer} has completed Phase 1. Finalize the Vault with your Secret Key 2.</p>
                             <button className="btn-cyber" style={{width: '100%'}} onClick={() => openModal('finalize', room)}>Seal Vault Permanently</button>
                          </div>
                        )}

                        {room.status === 'READY' && (
                           <div style={{display: 'flex', gap: '0.5rem', marginTop: 'auto'}}>
                               <button className="btn-cyber" style={{flex: 1}} onClick={() => openModal('unlock', room)}>
                                   <RadioTower size={18} /> Initiate Synchronized Breach
                               </button>
                               <button 
                                 className="btn-secondary" 
                                 style={{
                                   padding: '0.5rem 1.25rem', 
                                   background: 'rgba(239, 68, 68, 0.1)', 
                                   color: '#f87171', 
                                   border: '1px solid rgba(239, 68, 68, 0.3)', 
                                   fontSize: '0.85rem', 
                                   fontWeight: '600', 
                                   borderRadius: '8px',
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: '0.5rem',
                                   transition: 'all 0.2s ease'
                                 }} 
                                 onClick={() => openTrustModal(room.id)}
                                 onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                 onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                               >
                                   <ShieldAlert size={16} /> Trust Issue
                               </button>
                           </div>
                        )}
                     </div>
                   )
               })}
           </div>
        </div>
      )}

      {/* REACT OVERLAY MODALS FOR PIN CODES */}
      {modalType && (
        <div className="modal-overlay">
           <div className="modal-content">
              {modalType === 'waiting_peer' ? (
                 <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem'}}>
                    <div className="blinking-indicator" />
                    <h3 style={{color: 'var(--accent-primary)'}}>Turn-Key Actuated</h3>
                    <p style={{color: 'var(--text-secondary)'}}>Your lock is disengaged. Pinging your peer for simultaneous entry.</p>
                    <p style={{color: 'white'}}>Vault will collapse locally if key window expires.</p>
                    <button className="btn-cancel" onClick={handleLeaveRoom}>Abort Breach</button>
                 </div>
              ) : (
                <form onSubmit={handleModalSubmit}>
                   <Shield size={48} color="var(--accent-primary)" style={{marginBottom: '1rem'}} />
                   <h2 style={{color: 'white', marginBottom: '0.5rem'}}>
                      {modalType === 'accept' && 'Genesis Pin Configuration'}
                      {modalType === 'finalize' && 'Finalize Vault Locks'}
                      {modalType === 'unlock' && 'Synchronous Breach Required'}
                   </h2>
                   <p style={{color: 'var(--text-secondary)'}}>
                      {modalType === 'accept' && 'Generate your half of the permanent encryption lock. Never share this with anyone.'}
                      {modalType === 'finalize' && 'Generate your half of the encryption lock to seal this vault permanently.'}
                      {modalType === 'unlock' && 'Enter your confidential 4-Digit sequence. Both parties must be online.'}
                   </p>

                   {error && <div style={{color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginTop: '1rem'}}>{error}</div>}

                   <input 
                      type="password" 
                      className="pin-input"
                      placeholder="----" 
                      maxLength={4} 
                      value={tempPin}
                      onChange={e => setTempPin(e.target.value.replace(/\D/g, ''))} // only digits
                      required 
                      autoFocus
                   />

                   <div className="modal-actions">
                      <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                      <button type="submit" className="btn-cyber">
                        {modalType === 'unlock' ? 'Execute Turn-Key' : 'Engage Lock'}
                      </button>
                   </div>
                </form>
              )}
           </div>
        </div>
      )}

      {view === 'chat' && (
        <div className="darkroom-chat-view" style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0}}>
          <div className="messages-area glass-panel darkroom-messages" style={{flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '1rem', display: 'flex', flexDirection: 'column'}}>
              <div className="encryption-notice">
                <Key size={14} /> DUAL-KEY SECURITY ENGAGED. ENCRYPTION PROTOCOLS NORMAL.
              </div>
              {messages.length === 0 ? (
                <div className="empty-chat animate-fade-in" style={{textAlign: 'center', marginTop: '2rem'}}>
                  <Shield size={64} className="faded-icon" />
                  <h3 style={{color: 'white'}}>Vault Breach Successful</h3>
                  <p style={{color: 'var(--text-secondary)'}}>System architecture permanently secured.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderUsername === username;
                  return (
                    <div key={index} className={`message-wrapper ${isMe ? 'message-right' : 'message-left'} animate-fade-in`} style={{animationDelay: '0s'}}>
                      {!isMe && <div className="message-sender" style={{color: 'var(--text-secondary)'}}>{msg.senderUsername}</div>}
                      <div className={`message-bubble ${isMe ? 'bubble-me-tech' : 'bubble-them-tech'}`} style={{padding: msg.messageType === 'IMAGE' ? '0.5rem' : ''}}>
                        {msg.messageType === 'IMAGE' ? (
                           <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                             {msg.content.includes('{"image":') ? (
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
          <form className="chat-input-area" onSubmit={transmitMessage} style={{flexShrink: 0, border: '1px solid rgba(139, 92, 246, 0.3)', background:'var(--bg-color)', padding:'1rem', display:'flex', gap:'1rem', borderRadius: '12px', marginTop: '1rem', alignItems: 'center'}}>
            
            {!isRecording && !audioBlobPreview && (
                <div style={{display: 'flex', gap: '0.25rem'}}>
                    <button type="button" onClick={() => setShowCameraMode(true)} style={{color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0}} title="Camera Capture">
                       <Camera size={20} />
                    </button>
                    <label style={{cursor: 'pointer', color: 'var(--accent-primary)'}} title="Upload Secure Image">
                       <Paperclip size={20} />
                       <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleImageUpload} />
                    </label>
                </div>
            )}
            
            {isRecording ? (
               <button type="button" onClick={stopRecording} className="blinking-mic" style={{color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0}} title="Stop Recording">
                  <Mic size={20} />
               </button>
            ) : !audioBlobPreview ? (
               <button type="button" onClick={startRecording} style={{color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0}} title="Record Audio Metric">
                  <Mic size={20} />
               </button>
            ) : null}

            {isRecording && (
               <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                  <div style={{display: 'flex', gap: '4px', alignItems: 'center', height: '24px'}}>
                     {audioBands.map((h, i) => (
                        <div key={i} style={{width: '4px', background: 'var(--accent-primary)', borderRadius: '4px', height: `${h}px`, transition: 'height 50ms ease'}}></div>
                     ))}
                  </div>
                  <span style={{fontFamily: 'monospace', color: 'var(--danger)', fontWeight: 'bold'}}>{formatTime(audioTimer)}</span>
                  <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', marginLeft: 'auto', paddingRight: '1rem'}}>Tap mic to lock...</span>
               </div>
            )}

            {audioBlobPreview && (
               <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                  <button type="button" onClick={discardAudio} style={{color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0}} title="Discard Recording">
                     <Trash2 size={20} />
                  </button>
                  <audio src={audioBlobPreview} controls style={{height: '35px', flex: 1, outline: 'none'}} />
               </div>
            )}

            {!isRecording && !audioBlobPreview && (
                <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Transmit strictly secure data..." style={{flex:1, background: 'transparent', border:'none', color:'white', fontSize: '1rem'}} />
            )}
            
            <button type="submit" className="btn-cyber" style={{padding: '0.5rem 1rem'}} disabled={(!messageInput.trim() && !audioBlobPreview) || isRecording}>
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
      
      <ConfirmModal 
        isOpen={isTrustModalOpen}
        title="Report Trust Issue?"
        message="Are you sure you want to report a Trust Issue? This will immediately collapse the vault and negatively impact your peer's trust rating permanently."
        confirmText="Report Issue"
        danger={true}
        onConfirm={handleTrustIssue}
        onCancel={() => {
          setIsTrustModalOpen(false);
          setTrustRoomId(null);
        }}
      />
    </div>
  );
}
