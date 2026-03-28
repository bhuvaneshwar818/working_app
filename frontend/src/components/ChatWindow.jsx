import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Shield, Send, Lock, Mic, Square, Paperclip, Trash2, Camera, Check, CheckCheck, Smile, CornerUpLeft, ArrowLeft } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import CameraCropper from '../components/CameraCropper';
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
      webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws`),
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

  return (
    <div className="chat-container" style={{height: '100%', borderRadius: '12px', overflow: 'hidden'}}>
      <header className="chat-header glass-panel" style={{borderRadius: '0'}}>
        {onBack && (
          <button onClick={onBack} className="btn-icon back-btn">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="chat-title">
          {peerAvatar ? <img src={peerAvatar} alt="Avatar" style={{width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover'}} /> : <Shield color="var(--accent-primary)" size={24} />}
          <h2 style={{textTransform: 'capitalize'}}>{peerName}</h2>
        </div>
        <ThemeToggle />
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
            const isMe = msg.senderUsername === username;
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

      <form className="chat-input-area glass-panel" onSubmit={sendMessage} style={{borderRadius: '0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
        {!isRecording && !audioBlobPreview && (
            <div style={{display: 'flex', gap: '0.25rem'}}>
                <button type="button" onClick={() => setShowCameraMode(true)} className="btn-icon" title="Camera Capture" disabled={!isConnected}>
                   <Camera size={18} />
                </button>
                <label className="btn-icon" style={{cursor: 'pointer', padding: '8px'}} title="Upload Photo">
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
            </div>
        )}
        
        {isRecording ? (
           <button type="button" onClick={stopRecording} className="btn-icon blinking-mic" style={{color: 'var(--danger)'}} title="Stop Recording">
              <Mic size={18} />
           </button>
        ) : !audioBlobPreview ? (
           <button type="button" onClick={startRecording} className="btn-icon" title="Record Audio" disabled={!isConnected}>
              <Mic size={18} />
           </button>
        ) : null}

        {!isRecording && !audioBlobPreview && (
            <input 
              type="text" 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Transmit a secure message..."
              disabled={!isConnected}
              style={{flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.6rem 1rem', borderRadius: '8px', color: 'white'}}
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

        <button type="submit" className="btn-primary send-btn" disabled={(!messageInput.trim() && !audioBlobPreview) || !isConnected || isRecording}>
          <Send size={18} />
        </button>
      </form>

      {showCameraMode && <CameraCropper onClose={() => setShowCameraMode(false)} onSend={p => { sendMediaMessage(p, 'IMAGE'); setShowCameraMode(false); }} />}
    </div>
  );
}
