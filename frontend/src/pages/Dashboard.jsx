import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check, X, MessageSquare, LogOut, Shield, ShieldAlert, Zap, User, Settings } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import './Dashboard.css';

export default function Dashboard() {
  const toast = useToast();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResultsArray, setSearchResultsArray] = useState([]);
  const [myProfilePic, setMyProfilePic] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [searchError, setSearchError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pendingDarkRooms, setPendingDarkRooms] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      const pendingRes = await api.get('/requests/pending');
      setPendingRequests(pendingRes.data);
      
      const activeRes = await api.get('/requests/active');
      setActiveChats(activeRes.data);
      
      const onlineRes = await api.get('/users/online');
      setOnlineUsers(onlineRes.data);
      
      const myUsername = localStorage.getItem('username');
      const darkRoomsRes = await api.get('/darkroom/mine');
      const darkPending = darkRoomsRes.data.filter(r => (r.receiverUsername === myUsername && r.status === 'PENDING') || (r.initiatorUsername === myUsername && r.status === 'ACCEPTED')).length;
      setPendingDarkRooms(darkPending);

      const profileRes = await api.get('/users/profile');
      if (profileRes.data.profilePicture) {
          setMyProfilePic(profileRes.data.profilePicture);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // refresh every 10s as fallback
    
    const token = localStorage.getItem('token');
    let client = null;
    if (token) {
       client = new Client({
         webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
         connectHeaders: { Authorization: `Bearer ${token}` },
         debug: () => {},
         onConnect: () => {
            client.subscribe('/user/queue/updates', () => {
               fetchDashboardData();
            });
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

  const handleSearch = async (e, username = searchUsername) => {
    if (e) e.preventDefault();
    setSearchError('');
    setSearchResult('');
    try {
      if (!username) return;
      await api.post('/requests/send', { receiverUsername: username });
      toast.success(`Secure connection request sent to ${username}.`);
      setSearchUsername('');
      setSearchResultsArray([]);
      fetchDashboardData(); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection attempt failed');
      setSearchError(err.response?.data?.message || 'Failed to send request');
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.post(`/requests/${id}/accept`);
      toast.success("Secure link established.");
      fetchDashboardData();
      navigate(`/chat/${id}`); 
    } catch (err) {
      toast.error("Handshake verification failed.");
      console.error(err);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/requests/${id}/reject`);
      toast.info("Connection request terminated.");
      fetchDashboardData();
    } catch (err) {
      toast.error("Failed to disconnect.");
      console.error(err);
    }
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    toast.success("Vault exited securely. Session terminated.");
    navigate('/');
  };

  const myUsername = localStorage.getItem('username');

  return (
    <div className="dashboard-container">
      <aside className="sidebar glass-panel">
        <div className="sidebar-header" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem'}}>
          <Shield color="var(--accent-primary)" size={32} />
          <h2 style={{fontSize: '1.5rem', fontWeight: 'bold'}}>SecureChat</h2>
        </div>
        
        <div className="sidebar-section">
          <h3>
            <MessageSquare size={16}/> Active Chats 
          </h3>
          {activeChats.length === 0 ? (
            <div className="empty-state">No active secure chats.</div>
          ) : (
            <div className="active-chats-list" style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px'}}>
              {activeChats.map(chat => {
                const peerName = chat.senderUsername === myUsername ? chat.receiverUsername : chat.senderUsername;
                const isOnline = onlineUsers.includes(peerName);
                return (
                  <button 
                    key={chat.id} 
                    className="btn-secondary" 
                    style={{textAlign: 'left', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}
                    onClick={() => navigate(`/chat/${chat.id}`, { state: { peerName } })}
                  >
                    <div style={{display: 'flex', alignItems: 'center', position: 'relative'}}>
                      {isOnline && (
                         <div 
                           title="Online" 
                           style={{
                             position: 'absolute', top: '-6px', left: '-12px', 
                             width: '10px', height: '10px', borderRadius: '50%', 
                             background: 'var(--success)', 
                             boxShadow: '0 0 8px var(--success)',
                             border: '2px solid var(--bg-secondary)'
                           }} 
                         />
                      )}
                      <span style={{fontWeight: chat.unreadCount > 0 ? 'bold' : 'normal', lineHeight: '1'}}>{peerName}</span>
                    </div>
                    {chat.unreadCount > 0 && <span style={{background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold'}}>{chat.unreadCount}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button 
          className="btn-secondary logout-btn" 
          onClick={() => navigate('/darkroom')} 
          style={{marginBottom: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><ShieldAlert size={18} /> Enter Dark Room</div>
          {pendingDarkRooms > 0 && <span style={{background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem'}}>{pendingDarkRooms}</span>}
        </button>

        <button 
          className="btn-secondary logout-btn" 
          onClick={() => navigate('/evaporator')} 
          style={{marginBottom: '0.5rem', background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa'}}>
          <Zap size={18} /> Evaporate Protocol
        </button>

        <button 
          className="btn-secondary logout-btn" 
          onClick={() => navigate('/profile')} 
          style={{marginBottom: '0.5rem', color: 'var(--text-primary)'}}>
          <Settings size={18} /> Settings
        </button>

        <button className="btn-secondary logout-btn" onClick={handleLogout} style={{background: 'rgba(0,0,0,0.2)'}}>
          <LogOut size={18} /> Exit Vault
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="main-header animate-fade-in" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            {myProfilePic ? (
              <img src={myProfilePic} alt="Profile" style={{width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)'}} />
            ) : (
              <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)'}}>
                 <User size={24} color="var(--accent-primary)" />
              </div>
            )}
            <h1>Welcome, <span className="gradient-text">{myUsername}</span></h1>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <button onClick={() => navigate('/profile')} className="btn-icon" style={{background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '50%', padding: '8px'}} title="Identity Configuration">
               <User size={20} color="var(--accent-primary)" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <section className="search-section glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2><UserPlus size={20} className="icon-mr"/> Connect with a Peer</h2>
          <form onSubmit={handleSearch} className="search-form" style={{position: 'relative'}}>
            <div className="search-input-wrapper" style={{width: '100%', position: 'relative'}}>
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Enter exact username..." 
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                required
                style={{width: '100%'}}
              />
               {searchResultsArray.length > 0 && (
                 <div className="search-dropdown glass-panel" style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-secondary)'}}>
                    {searchResultsArray.map(user => {
                       const uName = typeof user === 'string' ? user : user.username;
                       const isLocked = typeof user !== 'string' && user.allowIncomingRequests === "false";
                       const trustBreaks = parseInt(user.trustBreakCount || "0");
                       const successes = parseInt(user.successfulConnectionsCount || "0");
                       const total = trustBreaks + successes === 0 ? 1 : trustBreaks + successes;
                       const trustPercentage = Math.round((successes / total) * 100);
                       const untrustPercentage = Math.round((trustBreaks / total) * 100);

                       return (
                         <div key={uName} 
                           onClick={() => { 
                             if(isLocked) {
                                setSearchError("This peer is currently not accepting incoming requests.");
                                return;
                             }
                             setSearchUsername(uName); 
                             handleSearch(null, uName); 
                           }} 
                           style={{
                               padding: '0.75rem 1rem', 
                               cursor: isLocked ? 'not-allowed' : 'pointer', 
                               borderBottom: '1px solid var(--border)', 
                               display:'flex', alignItems:'center', gap:'0.75rem', 
                               color: isLocked ? 'var(--text-secondary)' : 'var(--text-primary)',
                               opacity: isLocked ? 0.7 : 1
                           }}
                         >
                            {(typeof user !== 'string' && user.profilePicture) ? (
                                <img src={user.profilePicture} alt="Avatar" style={{width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover'}} />
                            ) : (
                                <UserPlus size={16} color={isLocked ? 'var(--text-secondary)' : 'var(--accent-primary)'}/> 
                            )}
                            <div style={{display: 'flex', flexDirection: 'column'}}>
                              <span style={{fontWeight: '500'}}>{uName}</span>
                              <div style={{fontSize: '0.7rem', display: 'flex', gap: '0.5rem', marginTop: '2px'}}>
                                 <span style={{color: 'var(--success)'}}>Trust: {trustPercentage}%</span>
                                 <span style={{color: 'var(--danger)'}}>Untrust: {untrustPercentage}%</span>
                              </div>
                            </div>
                            {isLocked && <ShieldAlert size={16} style={{marginLeft: 'auto', color: 'var(--danger)'}} title="Requests Disabled" />}
                         </div>
                       )
                    })}
                 </div>
               )}
            </div>
            <button type="submit" className="btn-primary" style={{whiteSpace: 'nowrap'}}>Send Request</button>
          </form>
          {searchResult && <p className="success-text" style={{marginTop:'1rem', color:'var(--success)'}}>{searchResult}</p>}
          {searchError && <p className="error-text" style={{marginTop:'1rem', color:'var(--danger)'}}>{searchError}</p>}
        </section>

        <section className="requests-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            Pending Approvals
            {pendingRequests.length > 0 && <span style={{background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem'}}>{pendingRequests.length}</span>}
          </h2>
          
          <div className="requests-grid">
            {pendingRequests.length === 0 ? (
              <div className="glass-panel empty-state">Your inbox is clear. No pending requests.</div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="request-card glass-panel">
                  <div className="request-info">
                    <Shield size={24} className="icon-faded" />
                    <div>
                      <h4>{req.senderUsername}</h4>
                      <small>Wants to start a secure chat</small>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button onClick={() => handleAccept(req.id)} className="btn-icon success"><Check size={20}/></button>
                    <button onClick={() => handleReject(req.id)} className="btn-icon danger"><X size={20}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <ConfirmModal 
        isOpen={isLogoutModalOpen}
        title="Exit Vault"
        message="Are you sure you want to exit the vault? This will end your current session securely."
        confirmText="Exit Details"
        cancelText="Cancel"
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        danger={true}
      />
    </div>
  );
}
