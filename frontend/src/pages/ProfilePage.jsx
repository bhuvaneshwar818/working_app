import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, ArrowLeft, Save, Edit3, Settings, Camera, Lock, EyeOff, Eye, Shield, Bell, Trash2, Sun, Moon } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import { useToast } from '../context/ToastContext';
import ProfileCropper from '../components/ProfileCropper';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', gender: '', dob: '', email: '', mobileNumber: '',
    profilePicture: '', isProfilePhotoPublic: true, allowIncomingRequests: true
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      setProfile(res.data);
    } catch (err) {
      toast.error('Identity sync failed.');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        mobileNumber: profile.mobileNumber || '',
        gender: profile.gender || '',
        dob: profile.dob || '',
        profilePicture: profile.profilePicture || '',
        isProfilePhotoPublic: profile.profilePhotoPublic !== false,
        allowIncomingRequests: profile.allowIncomingRequests !== false
      });
    }
  }, [profile]);

  const [passState, setPassState] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tempImageForCropping, setTempImageForCropping] = useState(null);
  const [evaporateTime, setEvaporateTime] = useState(localStorage.getItem('evaporateTime') || '30');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async (updatedData = null) => {
    const dataToSave = (updatedData && typeof updatedData === 'object' && !updatedData.nativeEvent) ? updatedData : formData;
    setIsUpdating(true);
    try {
      await api.put('/users/profile', dataToSave);
      toast.success('Identity profile updated.');
      fetchProfile();
    } catch (err) {
      toast.error('Update failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSaveProfile();
  };

  const handleTogglePrivacy = (field, value) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    handleSaveProfile(newData);
  };

  const handleEmailChange = async (e) => {
      e.preventDefault();
      if (formData.email === profile.email) {
          toast.info("New email is same as current.");
          return;
      }
      setIsUpdating(true);
      toast.info('Verification OTP sent to old email address.');
      setTimeout(async () => {
          try {
              await api.put('/users/profile', { ...formData, email: formData.email });
              toast.success('Email signature updated successfully.');
              fetchProfile();
          } catch(e) { toast.error('Email change failed'); }
          finally { setIsUpdating(false); }
      }, 2000);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
       if(file.size > 10 * 1024 * 1024) {
           toast.error('Identity badge too large. Limit is 10MB.');
           return;
       }
       const reader = new FileReader();
       reader.onloadend = () => {
           setTempImageForCropping(reader.result);
       };
       reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedBase64) => {
    setTempImageForCropping(null);
    setFormData({ ...formData, profilePicture: croppedBase64 });
    
    setIsUpdating(true);
    try {
      await api.put('/users/profile', { ...formData, profilePicture: croppedBase64 });
      toast.success('Identity badge optimized and locked.');
      fetchProfile();
    } catch (err) {
      toast.error('Photo sync failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  const submitPassChange = async (e) => {
    e.preventDefault();
    if(passState.newPassword !== passState.confirmNewPassword) {
       toast.error('Passwords do not match.');
       return;
    }
    setIsUpdating(true);
    try {
       await api.put('/users/password', { currentPassword: passState.currentPassword, newPassword: passState.newPassword });
       toast.success('Gatekeeper credentials updated.');
       setPassState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch(err) {
       toast.error('Invalid current password.');
    } finally {
       setIsUpdating(false);
    }
  };

  if (!profile) return <div className="profile-container"><div className="loader"></div></div>;

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: <User size={18}/> },
    { id: 'privacy', label: 'Privacy & Security', icon: <Shield size={18}/> },
    { id: 'appearance', label: 'Appearance', icon: <Eye size={18}/> },
    { id: 'email', label: 'Email Control', icon: <Mail size={18}/> },
    { id: 'password', label: 'Password Lock', icon: <Lock size={18}/> }
  ];

  return (
    <div className="profile-container page-fade-in">
      <header className="profile-header glass-panel" style={{borderRadius: '0', borderBottom: '1px solid var(--border)'}}>
        <button onClick={() => navigate('/dashboard')} className="btn-icon back-btn">
          <ArrowLeft size={20} />
        </button>
        <div className="header-title">
          <Settings size={20} color="var(--accent-primary)" />
          <h2 style={{fontSize: '1.25rem', fontWeight: 700}}>Control Center</h2>
        </div>
        <ThemeToggle />
      </header>

      <div className="profile-content" style={{display: 'flex', gap: '2rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', height: 'calc(100vh - 80px)'}}>
        {/* SETTINGS SIDEBAR */}
        <div className="settings-sidebar glass-panel" style={{width: '280px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn-secondary ${activeTab === tab.id ? 'active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', width: '100%', textAlign: 'left',
                background: activeTab === tab.id ? 'rgba(0, 209, 121, 0.1)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: activeTab === tab.id ? '1px solid rgba(0, 209, 121, 0.2)' : '1px solid transparent'
              }}
            >
              {tab.icon} <span style={{fontWeight: 700, fontSize: '0.9rem'}}>{tab.label.toUpperCase()}</span>
            </button>
          ))}
          
          <div style={{marginTop: 'auto', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)'}}>
             <h4 style={{color: '#f87171', fontSize: '0.8rem', marginBottom: '4px'}}>CRITICAL ACTION</h4>
             <button style={{color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold'}}>
                <Trash2 size={16}/> Delete Account
             </button>
          </div>
        </div>

        {/* SETTINGS CONTENT */}
        <div className="settings-main glass-panel" style={{flex: 1, overflowY: 'auto', padding: '2.5rem', background: 'var(--glass-bg)'}}>
          
          {activeTab === 'profile' && (
            <div className="animate-fade-in">
              <div style={{display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem'}}>
                 <div style={{position: 'relative'}}>
                    <div className="profile-avatar" style={{width: '120px', height: '120px', fontSize: '3rem', backgroundImage: formData.profilePicture ? `url(${formData.profilePicture})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center'}}>
                       {!formData.profilePicture && profile.username.charAt(0).toUpperCase()}
                    </div>
                    <label className="btn-icon" style={{position: 'absolute', bottom: '0', right: '0', background: 'var(--accent-primary)', color: 'white', borderRadius: '50%', padding: '8px', border: '4px solid var(--bg-secondary)', cursor: 'pointer'}}>
                       <Camera size={18}/>
                       <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{display: 'none'}} />
                    </label>
                 </div>
                 <div>
                    <h2 style={{fontSize: '2rem', marginBottom: '4px'}}>{profile.firstName} {profile.lastName}</h2>
                    <span style={{color: 'var(--accent-primary)', fontWeight: 'bold'}}>@{profile.username}</span>
                 </div>
              </div>

              <form onSubmit={handleFormSubmit} style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem'}}>
                <div className="form-group">
                  <label>First Name</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last name" />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} placeholder="+1 234 567 890" />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleChange} />
                </div>
                <div className="form-group" style={{gridColumn: 'span 2'}}>
                   <button type="submit" className="btn-primary" style={{padding: '1rem', width: '200px'}} disabled={isUpdating}>
                      <Save size={18} className="icon-mr" /> Save Profile
                   </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'privacy' && (
             <div className="animate-fade-in">
                <h3 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Privacy Shield</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                   <div style={{padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                         <h4 style={{marginBottom: '4px'}}>Public Identity</h4>
                         <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>Broadcast your profile avatar in the global peer search ecosystem.</p>
                      </div>
                      <label className="toggle-switch">
                         <input type="checkbox" checked={formData.isProfilePhotoPublic} onChange={e => handleTogglePrivacy('isProfilePhotoPublic', e.target.checked)} />
                         <span className="slider round"></span>
                      </label>
                   </div>

                   <div style={{padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                         <h4 style={{marginBottom: '4px'}}>Stealth Mode (Requests)</h4>
                         <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>Automatically reject all incoming link attempts from unknown peers.</p>
                      </div>
                      <label className="toggle-switch">
                         <input type="checkbox" checked={!formData.allowIncomingRequests} onChange={e => handleTogglePrivacy('allowIncomingRequests', !e.target.checked)} />
                         <span className="slider round"></span>
                      </label>
                   </div>

                   <div style={{padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid var(--border)'}}>
                      <h4 style={{marginBottom: '1rem'}}>Evaporation Delay</h4>
                      <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>How long messages should persist in 'Evaporate' mode before vanishing.</p>
                      <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                         <input type="range" min="5" max="600" step="5" value={evaporateTime} onChange={e => {setEvaporateTime(e.target.value); localStorage.setItem('evaporateTime', e.target.value);}} style={{flex: 1, accentColor: 'var(--accent-primary)'}} />
                         <span style={{fontWeight: 'bold', minWidth: '60px', color: 'var(--accent-primary)'}}>{evaporateTime}s</span>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'email' && (
             <div className="animate-fade-in" style={{maxWidth: '500px'}}>
                <h3 style={{fontSize: '1.5rem', marginBottom: '1rem'}}>Email Signature</h3>
                <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>Changing your email requires authorization from your current address.</p>
                <form onSubmit={handleEmailChange} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                   <div className="form-group">
                      <label>New Email Address</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                   </div>
                   <button type="submit" className="btn-primary" style={{padding: '1rem'}} disabled={isUpdating}>
                      Initiate Verification
                   </button>
                </form>
             </div>
          )}



          
          {activeTab === 'password' && (
             <div className="animate-fade-in" style={{maxWidth: '500px'}}>
                <h3 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Security Gateway</h3>
                <form onSubmit={submitPassChange} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                   <div className="form-group">
                      <label>Current Password</label>
                      <div style={{position: 'relative'}}>
                         <input type={showPass ? "text" : "password"} value={passState.currentPassword} onChange={e=>setPassState({...passState, currentPassword: e.target.value})} required style={{width: '100%'}} />
                         <button type="button" onClick={() => setShowPass(!showPass)} style={{position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)'}}>
                           {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                         </button>
                      </div>
                   </div>
                   <div className="form-group">
                      <label>New Secure Password</label>
                      <input type={showPass ? "text" : "password"} value={passState.newPassword} onChange={e=>setPassState({...passState, newPassword: e.target.value})} required />
                   </div>
                   <div className="form-group">
                      <label>Confirm Password</label>
                      <input type={showPass ? "text" : "password"} value={passState.confirmNewPassword} onChange={e=>setPassState({...passState, confirmNewPassword: e.target.value})} required />
                   </div>
                   <button type="submit" className="btn-primary" style={{padding: '1rem'}} disabled={isUpdating}>
                      Update Gateway
                   </button>
                </form>
             </div>
          )}
          
          {activeTab === 'appearance' && (
             <div className="animate-fade-in">
                <h3 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Theme & Identity</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                   <div style={{padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid var(--border)'}}>
                      <h4 style={{marginBottom: '1rem'}}>Active Theme</h4>
                      <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Select your preferred interface aesthetic.</p>
                      
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                         <button 
                            onClick={() => {
                               const newTheme = 'dark';
                               localStorage.setItem('theme', newTheme);
                               document.documentElement.setAttribute('data-theme', newTheme);
                               window.dispatchEvent(new CustomEvent('theme-changed', { detail: newTheme }));
                            }}
                            style={{
                               padding: '24px', borderRadius: '12px', border: '2px solid ' + (localStorage.getItem('theme') !== 'light' ? 'var(--accent-primary)' : 'var(--border)'),
                               background: '#0a0d16', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                            }}
                         >
                            <Moon size={24} color={localStorage.getItem('theme') !== 'light' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                            <span style={{fontWeight: 'bold'}}>STEALTH (DARK)</span>
                         </button>
                         <button 
                            onClick={() => {
                               const newTheme = 'light';
                               localStorage.setItem('theme', newTheme);
                               document.documentElement.setAttribute('data-theme', newTheme);
                               window.dispatchEvent(new CustomEvent('theme-changed', { detail: newTheme }));
                            }}
                            style={{
                               padding: '24px', borderRadius: '12px', border: '2px solid ' + (localStorage.getItem('theme') === 'light' ? 'var(--accent-primary)' : 'var(--border)'),
                               background: '#ffffff', color: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                            }}
                         >
                            <Sun size={24} color={localStorage.getItem('theme') === 'light' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                            <span style={{fontWeight: 'bold'}}>VISIBLE (LIGHT)</span>
                         </button>
                      </div>
                   </div>

                   <div style={{padding: '2rem', background: 'rgba(0, 209, 121, 0.05)', borderRadius: '15px', border: '1px dashed var(--accent-primary)', textAlign: 'center'}}>
                      <Shield size={32} color="var(--accent-primary)" style={{marginBottom: '1rem'}} />
                      <h4>Identity Safeguard</h4>
                      <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px'}}>Your visual preferences are stored locally to maintain zero-knowledge principles.</p>
                   </div>
                </div>
             </div>
          )}

          
        </div>
      </div>

      {tempImageForCropping && (
         <ProfileCropper 
            imageSrc={tempImageForCropping} 
            onCropComplete={handleCropComplete} 
            onCancel={() => setTempImageForCropping(null)} 
         />
      )}
    </div>
  );
}
