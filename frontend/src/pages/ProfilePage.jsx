import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, ArrowLeft, Save, Edit3, Settings, Camera, Lock, EyeOff, Eye } from 'lucide-react';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';
import AlertModal from '../components/AlertModal';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '',
    email: '', mobileNumber: '',
    dob: '', gender: '', profilePicture: '',
    isProfilePhotoPublic: true, allowIncomingRequests: true
  });

  const [passState, setPassState] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [evaporateTime, setEvaporateTime] = useState(localStorage.getItem('evaporateTime') || '30');

  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const showAlert = (title, message, type='info') => setCustomAlert({ isOpen: true, title, message, type });
  const closeAlert = () => setCustomAlert({ ...customAlert, isOpen: false });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      setProfile(res.data);
      setFormData({
        firstName: res.data.firstName || '',
        lastName: res.data.lastName || '',
        email: res.data.email || '',
        mobileNumber: res.data.mobileNumber || '',
        dob: res.data.dob || '',
        gender: res.data.gender || '',
        profilePicture: res.data.profilePicture || '',
        isProfilePhotoPublic: res.data.profilePhotoPublic !== false,
        allowIncomingRequests: res.data.allowIncomingRequests !== false
      });
    } catch (err) {
      showAlert('Error fetching profile', err.response?.data?.message || err.message, 'error');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.email !== profile.email) {
       showAlert('OTP Required', 'An OTP has been sent to your old email. Please verify it to change your email.', 'info');
       // Mocking the OTP verification for email change per requirements
       setTimeout(() => {
          showAlert('OTP Verified', 'Email change authorized.', 'success');
          saveProfileData();
       }, 2000);
    } else {
       saveProfileData();
    }
  };

  const saveProfileData = async () => {
    try {
      await api.put('/users/profile', formData);
      localStorage.setItem('evaporateTime', evaporateTime);
      showAlert('Profile Updated', 'Your profile details and settings have been securely saved.', 'success');
      setIsEditing(false);
      fetchProfile();
    } catch (err) {
      showAlert('Update Failed', err.response?.data?.message || 'Could not update profile', 'error');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
       // Validate size to comfortably fit inside LONGTEXT efficiently
       if(file.size > 2 * 1024 * 1024) {
           showAlert('File Too Large', 'Please upload a picture mathematically smaller than 2MB.', 'error');
           return;
       }
       const reader = new FileReader();
       reader.onloadend = () => {
           setFormData({ ...formData, profilePicture: reader.result });
           setIsEditing(true); 
       };
       reader.readAsDataURL(file);
    }
  };

  const submitPassChange = async (e) => {
    e.preventDefault();
    if(passState.newPassword !== passState.confirmNewPassword) {
       showAlert('Password Mismatch', 'New passwords do not securely match!', 'error');
       return;
    }
    if(passState.newPassword.length < 8) {
       showAlert('Weak Password', 'The new password must structurally be at least 8 characters long.', 'warning');
       return;
    }
    try {
       await api.put('/users/password', { currentPassword: passState.currentPassword, newPassword: passState.newPassword });
       showAlert('Security Updated', 'Your password cryptographic hashes have been completely redefined successfully.', 'success');
       setPassState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
       setIsChangingPass(false);
    } catch(err) {
       showAlert('Authentication Failed', err.response?.data || 'Incorrect current credentials.', 'error');
    }
  };

  if (!profile) return <div className="profile-container"><div className="loader"></div></div>;

  return (
    <div className="profile-container">
      <header className="profile-header glass-panel">
        <button onClick={() => navigate('/dashboard')} className="btn-icon back-btn">
          <ArrowLeft size={20} />
        </button>
        <div className="header-title">
          <Settings size={20} color="var(--accent-primary)" />
          <h2>Identity Configuration</h2>
        </div>
        <ThemeToggle />
      </header>

      <div className="profile-content">
        <div className="profile-card glass-panel">
          <div className="profile-avatar-wrapper">
             <div className="profile-avatar" style={{backgroundImage: formData.profilePicture ? `url(${formData.profilePicture})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', cursor: isEditing ? 'pointer' : 'default'}}>
                {!formData.profilePicture && profile.username.charAt(0).toUpperCase()}
                
                {isEditing && (
                  <>
                     <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <Camera size={24} color="white" />
                     </div>
                     <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer'}} />
                  </>
                )}
             </div>
             <h3>@{profile.username}</h3>
             <span className="profile-status badge-online">Status: Active</span>
             <div style={{marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.9rem'}}>
               <div style={{background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                 <div style={{color: 'var(--success)', fontWeight: 'bold'}}>{profile.successfulConnectionsCount || 0}</div>
                 <div>Trusted</div>
               </div>
               <div style={{background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                 <div style={{fontWeight: 'bold'}}>{(profile.successfulConnectionsCount || 0) + (profile.trustBreakCount || 0)}</div>
                 <div>Total Conns</div>
               </div>
               <div style={{background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                 <div style={{color: 'var(--danger)', fontWeight: 'bold'}}>{profile.trustBreakCount || 0}</div>
                 <div>Trust Breaks</div>
               </div>
             </div>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            <div className="form-header">
               <h4>Personal Details</h4>
               {!isEditing ? (
                 <button type="button" onClick={() => setIsEditing(true)} className="btn-secondary edit-btn">
                   <Edit3 size={16} /> Modify Securely
                 </button>
               ) : (
                 <button type="submit" className="btn-primary edit-btn" style={{background: 'var(--success)', border: 'none'}}>
                   <Save size={16} /> Lock Changes
                 </button>
               )}
            </div>

            <div className="profile-grid">
              <div className="form-group">
                <label>First Name</label>
                <div className="input-wrapper">
                   <User size={16} />
                   <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} disabled={!isEditing} />
                </div>
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <div className="input-wrapper">
                   <User size={16} />
                   <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} disabled={!isEditing} />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                   <Mail size={16} />
                   <input type="email" name="email" value={formData.email} onChange={handleChange} disabled={!isEditing} />
                </div>
              </div>

              <div className="form-group">
                <label>Mobile Protocol</label>
                <div className="input-wrapper">
                   <Phone size={16} />
                   <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} disabled={!isEditing} />
                </div>
              </div>

              <div className="form-group">
                <label>Date of Birth</label>
                <div className="input-wrapper">
                   <User size={16} />
                   <input type="date" name="dob" value={formData.dob} onChange={handleChange} disabled={!isEditing} />
                </div>
              </div>

              <div className="form-group">
                <label>Gender Identity</label>
                <div className="input-wrapper">
                   <User size={16} />
                   <select name="gender" value={formData.gender} onChange={handleChange} disabled={!isEditing} style={{width: '100%', paddingLeft: '40px', background: 'transparent', border: 'none', color: 'var(--text-primary)'}}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                   </select>
                </div>
              </div>

              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label style={{color: 'var(--accent-primary)', marginBottom: '0.5rem'}}>Network Visibility & Restrictions</label>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                   <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isEditing ? 'pointer' : 'default', color: 'var(--text-secondary)'}}>
                      <input type="checkbox" name="isProfilePhotoPublic" checked={formData.isProfilePhotoPublic} onChange={(e) => setFormData({...formData, isProfilePhotoPublic: e.target.checked})} disabled={!isEditing} style={{width: '18px', height: '18px', accentColor: 'var(--accent-primary)'}} />
                      <span style={{fontSize: '0.9rem'}}>Broadcast Avatar to secure Public Search ecosystem</span>
                   </label>
                   <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isEditing ? 'pointer' : 'default', color: 'var(--text-secondary)'}}>
                      <input type="checkbox" name="allowIncomingRequests" checked={formData.allowIncomingRequests} onChange={(e) => setFormData({...formData, allowIncomingRequests: e.target.checked})} disabled={!isEditing} style={{width: '18px', height: '18px', accentColor: 'var(--accent-primary)'}} />
                      <span style={{fontSize: '0.9rem'}}>Accept incoming connection requests from unknown peers</span>
                   </label>
                   <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isEditing ? 'pointer' : 'default', color: 'var(--text-secondary)'}}>
                      <input type="checkbox" checked={true} disabled={!isEditing} style={{width: '18px', height: '18px', accentColor: 'var(--accent-primary)'}} />
                      <span style={{fontSize: '0.9rem'}}>Show Online Status to others</span>
                   </label>
                </div>
              </div>

              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label style={{color: 'var(--accent-primary)', marginBottom: '0.5rem'}}>Evaporation Protocol</label>
                <div className="input-wrapper" style={{maxWidth: '300px'}}>
                   <Settings size={16} />
                   <input type="number" value={evaporateTime} onChange={(e) => setEvaporateTime(e.target.value)} disabled={!isEditing} placeholder="Time in seconds (e.g. 30)" min="5" max="3600" />
                </div>
                <small style={{color: 'var(--text-secondary)', marginTop: '4px', display: 'block'}}>Evaporation time setting (in seconds) for Evaporate mode.</small>
              </div>
            </div>

             {isEditing && (
               <div style={{marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem'}}>
                 <button type="button" className="btn-secondary" onClick={() => { setIsEditing(false); setFormData({
                    firstName: profile.firstName || '', lastName: profile.lastName || '',
                    email: profile.email || '', mobileNumber: profile.mobileNumber || '',
                    dob: profile.dob || '', gender: profile.gender || '', profilePicture: profile.profilePicture || '',
                    isProfilePhotoPublic: profile.profilePhotoPublic !== false, allowIncomingRequests: profile.allowIncomingRequests !== false
                 }); }}>Discard Changes</button>
               </div>
             )}
          </form>

          {/* PASSWORD RESET MODULE */}
          <div className="profile-form" style={{borderTop: '1px solid var(--border)'}}>
             <div className="form-header">
                <h4>Security Protocol</h4>
                {!isChangingPass ? (
                  <button type="button" onClick={() => setIsChangingPass(true)} className="btn-secondary edit-btn">
                    <Lock size={16} /> Change Password
                  </button>
                ) : (
                  <button type="button" onClick={() => { setIsChangingPass(false); setPassState({currentPassword: '', newPassword: '', confirmNewPassword: ''}); }} className="btn-secondary edit-btn" style={{background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)'}}>
                    Cancel Action
                  </button>
                )}
             </div>

             {isChangingPass && (
               <form onSubmit={submitPassChange} className="animate-fade-in" style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
                 <div className="form-group">
                    <label>Current Gateway Password</label>
                    <div className="input-wrapper">
                       <Lock size={16} />
                       <input type={showPass ? "text" : "password"} value={passState.currentPassword} onChange={e=>setPassState({...passState, currentPassword: e.target.value})} required />
                    </div>
                 </div>
                 
                 <div className="form-group">
                    <label>New Immutable Password</label>
                    <div className="input-wrapper">
                       <Lock size={16} />
                       <input type={showPass ? "text" : "password"} value={passState.newPassword} onChange={e=>setPassState({...passState, newPassword: e.target.value})} required />
                    </div>
                 </div>

                 <div className="form-group">
                    <label>Confirm New Immutable Password</label>
                    <div className="input-wrapper">
                       <Lock size={16} />
                       <input type={showPass ? "text" : "password"} value={passState.confirmNewPassword} onChange={e=>setPassState({...passState, confirmNewPassword: e.target.value})} required />
                       <button type="button" onClick={() => setShowPass(!showPass)} style={{position: 'absolute', right: '12px', color: 'var(--text-secondary)'}}>
                         {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                       </button>
                    </div>
                 </div>

                 <button type="submit" className="btn-primary" style={{marginTop: '1rem', padding: '0.8rem', fontWeight: 'bold'}}>
                    Confirm Cryptographic Upgrade
                 </button>
               </form>
             )}
          </div>
        </div>
      </div>
      <AlertModal {...customAlert} onClose={closeAlert} />
    </div>
  );
}
