import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import { Search, UserPlus, Check, X, MessageSquare, LogOut, Shield, ShieldAlert, Zap, User, Settings } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import ConfirmModal from '../components/ConfirmModal';
import ChatWindow from '../components/ChatWindow';
import { useToast } from '../context/ToastContext';
import './Dashboard.css';

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResultsArray, setSearchResultsArray] = useState([]);
  const [myProfilePic, setMyProfilePic] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [searchResult, setSearchResult] = useState('');
  const [searchError, setSearchError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pendingDarkRooms, setPendingDarkRooms] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const myUsername = localStorage.getItem('username');

  const fetchDashboardData = async () => {
    try {
      const pendingRes = await api.get('/requests/pending');
      setPendingRequests(pendingRes.data);

      try {
        const sentRes = await api.get('/requests/sent');
        setSentRequests(sentRes.data);
      } catch (err) { console.error('Failed to fetch sent requests', err); }
      
      const activeRes = await api.get('/requests/active');
      setActiveChats(activeRes.data);
      
      const onlineRes = await api.get('/users/online');
      setOnlineUsers(onlineRes.data);
      
      const darkRoomsRes = await api.get('/darkroom/mine');
      const darkPending = darkRoomsRes.data.filter(r => (r.receiverUsername === myUsername && r.status === 'PENDING') || (r.initiatorUsername === myUsername && r.status === 'ACCEPTED')).length;
      setPendingDarkRooms(darkPending);

      const profileRes = await api.get('/users/profile');
      setMyProfile(profileRes.data);
      if (profileRes.data.profilePicture) {
          setMyProfilePic(profileRes.data.profilePicture);
      }
    } catch (err) {
      console.error('Data fetch failed', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    
    const token = localStorage.getItem('token');
    let client = null;
    if (token) {
       client = new Client({
         webSocketFactory: () => new SockJS(`http://${window.location.hostname}:8080/ws`),
         connectHeaders: { Authorization: `Bearer ${token}` },
         onConnect: () => {
            client.subscribe('/user/queue/updates', () => fetchDashboardData());
         }
       });
       client.activate();
    }
    
    return () => {
       clearInterval(interval);
       if (client) client.deactivate();
    };
  }, []);

  useEffect(() => {
    if (searchUsername.trim().length > 1) {
       const timer = setTimeout(async () => {
          try {
             const res = await api.get(`/users/search?q=${searchUsername}`);
             setSearchResultsArray(res.data);
          } catch (e) { setSearchResultsArray([]); }
       }, 300);
       return () => clearTimeout(timer);
    } else {
       setSearchResultsArray([]);
    }
  }, [searchUsername]);

  const handleSendRequest = async (username) => {
    setSearchError('');
    setSearchResult('');
    try {
      await api.post('/requests/send', { receiverUsername: username });
      toast.success(`Secure connection request sent to ${username}.`);
      setSearchUsername('');
      setSearchResultsArray([]);
      fetchDashboardData(); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection attempt failed');
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.post(`/requests/${id}/accept`);
      toast.success("Secure link established.");
      fetchDashboardData();
      navigate(`/dashboard/chat/${id}`); 
    } catch (err) {
      toast.error("Handshake verification failed.");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/requests/${id}/reject`);
      toast.info("Connection request terminated.");
      fetchDashboardData();
    } catch (err) { toast.error('Failed to reject'); }
  };

  const handleLogout = () => setIsLogoutModalOpen(true);

  // Stats calculation
  const getStats = () => {
      let trustPercentage = 100; // Start at 100% for new users
      if (myProfile) {
          const successes = parseInt(myProfile.successfulConnectionsCount) || 0;
          const breaks = parseInt(myProfile.trustBreakCount) || 0;
          if (successes + breaks > 0) {
              trustPercentage = Math.round((successes / (successes + breaks)) * 100);
          }
      }
      return { trustPercentage, untrustPercentage: 100 - trustPercentage };
  };

  const { trustPercentage, untrustPercentage } = getStats();

  return (
    <div className="dashboard-container">
      <aside className="sidebar glass-panel">
        <div className="sidebar-header" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', cursor: 'pointer'}} onClick={() => navigate('/dashboard')}>
          <Shield color="var(--accent-primary)" size={32} />
          <h2 style={{fontSize: '1.5rem', fontWeight: 'bold'}}>SecureChat</h2>
        </div>
        
        <div className="sidebar-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <MessageSquare size={14} style={{marginRight: '6px'}}/> Active Chats 
            </h3>
          </div>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={chatSearchTerm}
              onChange={(e) => setChatSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 30px', fontSize: '0.85rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="active-chats-list" style={{display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto'}}>
            {activeChats.filter(chat => {
              const peerName = chat.senderUsername === myUsername ? chat.receiverUsername : chat.senderUsername;
              return peerName.toLowerCase().includes(chatSearchTerm.toLowerCase());
            }).map(chat => {
              const peerName = chat.senderUsername.toLowerCase() === myUsername.toLowerCase() ? chat.receiverUsername : chat.senderUsername;
              const isOnline = onlineUsers.includes(peerName);
              const isActive = location.pathname.includes(`/chat/${chat.id}`);
              return (
                <button 
                  key={chat.id} 
                  className={`btn-secondary ${isActive ? 'active' : ''}`}
                  style={{
                    textAlign: 'left', padding: '10px 12px', 
                    background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent', 
                    borderRadius: '8px', border: 'none', width: '100%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: '0.2s'
                  }}
                  onClick={() => navigate(`/dashboard/chat/${chat.id}`, { state: { peerName } })}
                >
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', position: 'relative'}}>
                    <div style={{position: 'relative'}}>
                        <div style={{width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)'}}>
                            {chat.peerProfilePicture ? (
                                <img src={chat.peerProfilePicture} alt="Peer" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                            ) : (
                                <User size={20} color={isOnline ? 'var(--success)' : 'var(--text-secondary)'} />
                            )}
                        </div>
                        {isOnline && <div style={{position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg-secondary)'}}></div>}
                    </div>
                    <span style={{fontWeight: chat.unreadCount > 0 ? 'bold' : 'normal', fontSize: '0.95rem'}}>{peerName}</span>
                  </div>
                  {chat.unreadCount > 0 && <span style={{background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold'}}>{chat.unreadCount}</span>}
                </button>
              )
            })}
            {activeChats.length === 0 && <div className="empty-state" style={{fontSize: '0.8rem', padding: '1rem', textAlign: 'center', opacity: 0.5}}>No active chats.</div>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={() => navigate('/darkroom')} style={{padding: '0.85rem 1.25rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.15)', transition: 'all 0.2s', width: '100%'}} 
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.8rem'}}><ShieldAlert size={20} /> <span style={{fontWeight: 700}}>DARK ROOM</span></div>
              {pendingDarkRooms > 0 && <span style={{background: 'var(--danger)', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'}}>{pendingDarkRooms}</span>}
            </div>
          </button>

          <button className="btn-secondary" onClick={() => navigate('/evaporator')} style={{padding: '0.85rem 1.25rem', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%', transition: 'all 0.2s'}}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
             <Zap size={20} /> <span style={{fontWeight: 700}}>SECURE ACCESS</span>
          </button>

          <button className="btn-secondary" onClick={() => navigate('/profile')} style={{padding: '0.85rem 1.25rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%', transition: 'all 0.2s'}}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
             <Settings size={20} /> <span style={{fontWeight: 700}}>SETTINGS</span>
          </button>

          <button className="btn-secondary" onClick={handleLogout} style={{padding: '0.85rem 1.25rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%', transition: 'all 0.2s'}}
             onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
             onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <LogOut size={20} /> <span style={{fontWeight: 700}}>EXIT VAULT</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main" style={{padding: '0', background: 'transparent', height: '100vh', overflow: 'hidden'}}>
        <Routes>
          <Route path="chat/:chatRequestId" element={<ChatWindow onBack={() => navigate('/dashboard')} />} />
          <Route path="*" element={
            <div style={{padding: '2rem 3rem', height: '100%', overflowY: 'auto'}}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <header>
                  <h1 style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>Base <span className="gradient-text">Operations</span></h1>
                  <p style={{color: 'var(--text-secondary)', fontSize: '1.1rem'}}>Secure encrypted environment active for {myUsername}.</p>
                </header>
                
                <section style={{display: 'flex', gap: '1.5rem'}}>
                    <div className="glass-panel" style={{padding: '1.5rem', flex: '1', display: 'flex', alignItems: 'center', gap: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.2)'}}>
                        {myProfilePic ? <img src={myProfilePic} alt="Avatar" style={{width:'80px', height:'80px', borderRadius:'50%', border: '4px solid var(--accent-primary)', padding: '2px'}} /> : <div style={{width:'80px', height:'80px', borderRadius:'50%', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center'}}><User size={40}/></div>}
                        <div style={{flex: 1}}>
                            <h2 style={{margin: '0 0 0.5rem 0', textTransform: 'capitalize'}}>{myUsername}</h2>
                            <div style={{display: 'flex', gap: '1.25rem'}}>
                                <div><div style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)'}}>{trustPercentage}%</div><div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>TRUST</div></div>
                                <div><div style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger)'}}>{myProfile?.trustBreakCount || 0}</div><div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>UNTRUST</div></div>
                                <div><div style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)'}}>{myProfile?.successfulConnectionsCount || 0}</div><div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>PEERS</div></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="glass-panel" style={{padding: '1.5rem'}}>
                  <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom: '1rem'}}><UserPlus size={18} color="var(--accent-primary)"/> Establish New Link</h3>
                  <div style={{position: 'relative'}}>
                      <div className="search-input-wrapper" style={{width: '100%'}}>
                        <Search className="search-icon" size={20} />
                        <input type="text" placeholder="Search identity signatures..." value={searchUsername} onChange={(e) => setSearchUsername(e.target.value)} style={{width:'100%', padding:'12px 12px 12px 45px'}} />
                      </div>
                      
                      {searchResultsArray.length > 0 && (
                        <div className="glass-panel" style={{position: 'absolute', top:'105%', left:0, right:0, zIndex: 100, maxHeight:'300px', overflowY:'auto', background:'var(--bg-secondary)', border:'1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'}}>
                          {searchResultsArray.map(user => (
                            <div key={user.username} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                              <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                                {user.profilePicture ? <img src={user.profilePicture} style={{width:'32px', height:'32px', borderRadius:'50%'}} /> : <User size={16}/>}
                                <span style={{fontWeight: 500}}>{user.username}</span>
                              </div>
                              <button onClick={() => handleSendRequest(user.username)} className="btn-primary" style={{padding:'6px 12px', fontSize:'0.85rem'}} disabled={!user.allowIncomingRequests}>Link Peer</button>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <section>
                    <h3 style={{marginBottom: '1rem', fontSize: '1rem'}}>Incoming Requests {pendingRequests.length > 0 && <span style={{background:'var(--danger)', padding:'2px 8px', borderRadius:'10px', fontSize:'0.7rem'}}>{pendingRequests.length}</span>}</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                      {pendingRequests.map(req => (
                        <div key={req.id} className="request-card glass-panel" style={{padding:'1rem'}}>
                          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                               <Shield size={20} color="var(--accent-primary)"/>
                               <strong>{req.senderUsername}</strong>
                             </div>
                             <div style={{display:'flex', gap:'5px'}}>
                               <button onClick={() => handleAccept(req.id)} className="btn-icon success"><Check size={18}/></button>
                               <button onClick={() => handleReject(req.id)} className="btn-icon danger"><X size={18}/></button>
                             </div>
                          </div>
                        </div>
                      ))}
                      {pendingRequests.length === 0 && <div className="glass-panel" style={{padding:'1rem', textAlign:'center', opacity:0.5}}>No pending incoming requests.</div>}
                    </div>
                  </section>
                  
                  <section>
                    <h3 style={{marginBottom: '1rem', fontSize: '1rem'}}>Active Sent Requests</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                      {sentRequests.map(req => (
                        <div key={req.id} className="glass-panel" style={{padding:'1rem', opacity: 0.6}}>
                          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                             <strong>{req.receiverUsername}</strong>
                             <span style={{fontSize:'0.7rem', color:'var(--text-secondary)'}}>PENDING</span>
                          </div>
                        </div>
                      ))}
                      {sentRequests.length === 0 && <div className="glass-panel" style={{padding:'1rem', textAlign:'center', opacity:0.5}}>No active sent requests.</div>}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </main>

      <ConfirmModal 
        isOpen={isLogoutModalOpen}
        title="Exit the Vault?"
        message="Are you sure you want to end your secure session?"
        onConfirm={() => { localStorage.clear(); navigate('/auth'); }}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
}
