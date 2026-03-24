import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, User, Phone, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../api';
import { GoogleLogin } from '@react-oauth/google';
import ThemeToggle from '../components/ThemeToggle';
import { useToast } from '../context/ToastContext';
import './AuthPage.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isForgotUsername, setIsForgotUsername] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auth Form State
  const [formData, setFormData] = useState({
    username: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', 
    gender: '', dob: '', 
    email: '', mobileNumber: '',
    otp: ''
  });
  
  const [signupStep, setSignupStep] = useState(1); // Phase 1=Details, Phase 2=Username/Password
  
  const [emailStatus, setEmailStatus] = useState('idle'); // idle, checking, valid, invalid
  const [emailMsg, setEmailMsg] = useState('');

  // Forgot Password State
  const [fpStep, setFpStep] = useState(1); // 1 = Email, 2 = Verify OTP & Reset
  const [fpEmail, setFpEmail] = useState('');
  const [fpUsernameOrPhone, setFpUsernameOrPhone] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  
  const [fuEmail, setFuEmail] = useState('');
  const [fuPhone, setFuPhone] = useState('');
  const [fuDob, setFuDob] = useState('');

  const [googleToken, setGoogleToken] = useState('');
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'email') setEmailStatus('idle'); // Reset checking visual on type
  };

  const handleEmailBlur = async () => {
    if (!formData.email) return;
    setEmailStatus('checking');
    try {
      const res = await api.post('/auth/validate-email', { email: formData.email });
      setEmailStatus('valid');
      setEmailMsg(res.data.message);
    } catch (err) {
      setEmailStatus('invalid');
      setEmailMsg(err.response?.data || 'Real-world validation failed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    
    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { username: formData.username, password: formData.password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        toast.success(`Access Granted. Welcome back, ${res.data.username}.`);
        navigate('/dashboard');
      } else if (!isLogin && signupStep === 3) {
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passcodes do not securely match!');
            return;
        }
        const res = await api.post('/auth/google-register', { 
            token: googleToken, 
            username: formData.username, 
            password: formData.password 
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        toast.success(`Google Registration Complete. Welcome, ${res.data.username}.`);
        navigate('/dashboard');
      } else {
        // Password validation
        if (isLogin === false && (signupStep === 2 || signupStep === 3)) {
          const pass = formData.password;
          const errors = [];
          if (pass.length < 8) errors.push('minimum 8 characters');
          if (!/[A-Z]/.test(pass)) errors.push('a capital letter');
          if (!/[a-z]/.test(pass)) errors.push('a small letter');
          if (!/[0-9]/.test(pass)) errors.push('a digit');
          if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) errors.push('a special character');
          
          if (errors.length > 0) {
            toast.warning(`Weak Password: Missing ${errors.join(', ')}`);
            setIsLoading(false);
            return;
          }
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passcodes do not securely match!');
            setIsLoading(false);
            return;
        }
        // Strict Email Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
           toast.warning('Invalid email format detected.');
           setIsLoading(false);
           return;
        }

        const res = await api.post('/auth/register', formData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        toast.success("Security account created successfully!");
        navigate('/dashboard');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || 'Authentication failed';
      setError(typeof errMsg === 'string' ? errMsg : 'Authentication failed');
      toast.error(typeof errMsg === 'string' ? errMsg : 'Access Denied');
      
      if (typeof errMsg === 'string') {
        const lowerMsg = errMsg.toLowerCase();
        if (
          lowerMsg.includes('already taken') || 
          lowerMsg.includes('already registered') || 
          lowerMsg.includes('user not found')
        ) {
           toast.error(errMsg);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSignupOtp = async () => {
    if (isLoading) return;
    if (emailStatus !== 'valid') {
       toast.warning('Email verification pending.');
       return;
    }
    if (!formData.email) {
      toast.warning(`Email ID required for OTP dispatch.`);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/auth/send-signup-otp', { identifier: formData.email, type: 'email' });
      toast.success('Verification code dispatched.');
    } catch (err) {
      toast.error(err.response?.data || 'Failed to dispatch verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpAndProceed = async () => {
     if (isLoading) return;
     if (!formData.otp || formData.otp.length < 6) {
        toast.warning('Enter the 6-Digit code.');
        return;
     }
     setIsLoading(true);
     try {
        await api.post('/auth/verify-signup-otp', { identifier: formData.email, otp: formData.otp });
        setSignupStep(2);
        toast.success('Identity Verified Successfully.');
     } catch (err) {
        toast.error(err.response?.data || 'Invalid OTP code.');
     } finally {
        setIsLoading(false);
     }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
     if (isLoading) return;
     setIsLoading(true);
     try {
       const res = await api.post('/auth/google', { token: credentialResponse.credential });
       if (res.data.requiresSetup) {
           setGoogleToken(credentialResponse.credential);
           setIsLogin(false);
           setSignupStep(3); // Enter Google Credentials Phase
       } else {
           localStorage.setItem('token', res.data.token);
           localStorage.setItem('username', res.data.username);
           navigate('/dashboard');
       }
     } catch (err) {
       toast.error(err.response?.data || 'Google verification failed securely.');
     } finally {
       setIsLoading(false);
     }
  };

  const handleForgotPassSubmit = async (e) => {
     e.preventDefault();
     if (isLoading) return;
     setError('');
     setIsLoading(true);
     try {
        if (fpStep === 1) {
            await api.post('/auth/forgot-password', { email: fpEmail, usernameOrPhone: fpUsernameOrPhone });
            setFpStep(2);
            toast.info("Check your registered email (or terminal console) for the OTP!");
        } else {
            if (fpNewPassword !== fpConfirmPassword) {
                toast.error('Your new passwords do not securely match!');
                return;
            }
            const res = await api.post('/auth/reset-password', { email: fpEmail, otp: fpOtp, newPassword: fpNewPassword });
            toast.success(res.data);
            setIsForgotPassword(false);
            setFpStep(1);
        }
     } catch (err) {
        setError(err.response?.data || 'Failed processing request');
     } finally {
        setIsLoading(false);
     }
  };

  const handleForgotUserSubmit = async (e) => {
     e.preventDefault();
     if (isLoading) return;
     setError('');
     setIsLoading(true);
     try {
         const res = await api.post('/auth/forgot-username', { email: fuEmail, phone: fuPhone, dob: fuDob });
         toast.success("Recovery details dispatched.");
         setIsForgotUsername(false);
         setFuEmail('');
         setFuPhone('');
         setFuDob('');
     } catch (err) {
         setError(err.response?.data || 'Server rejected recovery dispatch');
     } finally {
         setIsLoading(false);
     }
  };

  if (isForgotPassword) {
      return (
        <div className="auth-container">
          <div style={{position: 'absolute', top: '1.5rem', right: '2rem'}}>
             <ThemeToggle />
          </div>
          <div className="auth-card glass-panel" style={{maxWidth: '450px', width: '100%'}}>
            <div className="auth-header">
              <Shield size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
              <h2>Reset Password</h2>
            </div>
            
            {error && <div className="error-message" style={{color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center'}}>{error}</div>}

            <form onSubmit={handleForgotPassSubmit} className="auth-form" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
               {fpStep === 1 ? (
                  <>
                    <div className="form-group" style={{position: 'relative'}}>
                      <User size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                      <input type="text" placeholder="Username or Phone Number" value={fpUsernameOrPhone} onChange={e=>setFpUsernameOrPhone(e.target.value)} required style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} />
                    </div>
                    <div className="form-group" style={{position: 'relative'}}>
                      <Mail size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                      <input type="email" placeholder="Registered Email ID" value={fpEmail} onChange={e=>setFpEmail(e.target.value)} required style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} />
                    </div>
                  </>
               ) : (
                  <>
                    <div className="form-group" style={{position: 'relative'}}>
                       <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                       <input type="text" placeholder="6-Digit OTP" value={fpOtp} onChange={e=>setFpOtp(e.target.value)} required style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} maxLength={6} />
                    </div>
                    <div className="form-group" style={{position: 'relative'}}>
                       <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                       <input type={showPassword ? "text" : "password"} placeholder="New Password" value={fpNewPassword} onChange={e=>setFpNewPassword(e.target.value)} required minLength={8} style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} />
                       <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '12px', top: '10px', color: 'var(--text-secondary)'}}>
                         {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                       </button>
                    </div>
                    <div className="form-group" style={{position: 'relative'}}>
                       <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                       <input type={showPassword ? "text" : "password"} placeholder="Confirm New Password" value={fpConfirmPassword} onChange={e=>setFpConfirmPassword(e.target.value)} required minLength={8} style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} />
                    </div>
                  </>
               )}
               <button type="submit" className="btn-primary" disabled={isLoading} style={{marginTop: '1rem', padding: '0.75rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '8px', cursor: isLoading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                 {isLoading ? <Loader2 className="spin-animation" size={20} /> : (fpStep === 1 ? 'Dispatch OTP Code' : 'Verify & Perform Reset')}
               </button>
               <button type="button" onClick={() => { setIsForgotPassword(false); setFpStep(1); }} style={{textAlign: 'center', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', marginTop: '0.5rem', border: 'none'}}>
                  Return to standard Login
               </button>
            </form>
          </div>

        </div>
      );
  }

  if (isForgotUsername) {
      return (
        <div className="auth-container">
          <div style={{position: 'absolute', top: '1.5rem', right: '2rem'}}>
             <ThemeToggle />
          </div>
          <div className="auth-card glass-panel" style={{maxWidth: '450px', width: '100%'}}>
            <div className="auth-header">
              <Shield size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
              <h2>Username Recovery</h2>
            </div>
            {error && <div className="error-message" style={{color: 'white', background: 'var(--danger)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem'}}>{error}</div>}
            
            <form onSubmit={handleForgotUserSubmit} className="auth-form" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
               <div className="form-group" style={{position: 'relative'}}>
                 <Mail size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                 <input type="email" placeholder="Registered Email ID" value={fuEmail} onChange={e=>setFuEmail(e.target.value)} required style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} />
               </div>
               
               <div className="form-group" style={{position: 'relative'}}>
                 <Phone size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                 <input type="tel" placeholder="Mobile Number" value={fuPhone} onChange={e=>setFuPhone(e.target.value)} required style={{paddingLeft: '40px', width: '100%', padding: '0.75rem 0.75rem 0.75rem 40px', borderRadius: '8px'}} />
               </div>
               
               <div className="form-group" style={{position: 'relative'}}>
                 <input type="date" placeholder="Date of Birth" value={fuDob} onChange={e=>setFuDob(e.target.value)} required style={{width: '100%', padding: '0.75rem 0.75rem 0.75rem 12px', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)'}} />
               </div>
               
               <button type="submit" className="btn-primary" disabled={isLoading} style={{marginTop: '1rem', padding: '0.75rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '8px', cursor: isLoading ? 'wait' : 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                 {isLoading ? <Loader2 className="spin-animation" size={20} /> : 'Dispatch Recovery Ping'}
               </button>
               <button type="button" onClick={() => setIsForgotUsername(false)} style={{textAlign: 'center', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', marginTop: '0.5rem', border: 'none'}}>
                  ← Return to Security Gateway
               </button>
            </form>
          </div>

        </div>
      );
  }

  return (
    <div className="auth-container">
      <div style={{position: 'absolute', top: '1.5rem', right: '2rem'}}>
         <ThemeToggle />
      </div>
      <div className="auth-card glass-panel" style={{maxWidth: isLogin ? '400px' : '550px', width: '100%'}}>
        <div className="auth-header" style={{textAlign: 'center'}}>
          <Shield size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem auto' }} />
          <h2>{isLogin ? 'Secure Gateway' : 'Network Registration'}</h2>
        </div>

        <div className="auth-switch" style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem'}}>
          <button className={`switch-btn ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)} style={{borderBottom: isLogin ? '2px solid var(--accent-primary)' : 'none', padding: '0.5rem', color: isLogin ? 'var(--text-primary)' : 'var(--text-secondary)'}}>Log In</button>
          <button className={`switch-btn ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)} style={{borderBottom: !isLogin ? '2px solid var(--accent-primary)' : 'none', padding: '0.5rem', color: !isLogin ? 'var(--text-primary)' : 'var(--text-secondary)'}}>Sign Up</button>
        </div>

        {error && <div className="error-message" style={{color: 'white', background: 'var(--danger)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem'}}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          {!isLogin && signupStep === 1 && (
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
              <div className="form-group" style={{position: 'relative'}}>
                <input type="text" name="firstName" placeholder="First Name" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', borderRadius: '8px'}} />
              </div>
              <div className="form-group" style={{position: 'relative'}}>
                <input type="text" name="lastName" placeholder="Last Name" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', borderRadius: '8px'}} />
              </div>
              <div className="form-group" style={{position: 'relative'}}>
                <select name="gender" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)'}}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="form-group" style={{position: 'relative'}}>
                <input type="date" name="dob" placeholder="Date of Birth" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)'}} />
              </div>
              <div className="form-group" style={{position: 'relative', gridColumn: '1 / -1'}}>
                <Mail size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input 
                  type="email" name="email" placeholder="Email Address" 
                  onChange={handleChange} onBlur={handleEmailBlur} required 
                  style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', paddingRight: '40px', borderRadius: '8px', border: emailStatus === 'invalid' ? '1px solid var(--danger)' : emailStatus === 'valid' ? '1px solid var(--success)' : '1px solid var(--border)'}} 
                />
                <div style={{position: 'absolute', right: '12px', top: '10px'}}>
                  {emailStatus === 'checking' && <Loader2 size={18} className="spin-animation" style={{color: 'var(--text-secondary)'}}/>}
                  {emailStatus === 'valid' && <CheckCircle size={18} style={{color: 'var(--success)'}}/>}
                  {emailStatus === 'invalid' && <XCircle size={18} style={{color: 'var(--danger)'}}/>}
                </div>
                {emailStatus === 'invalid' && <small style={{color: 'var(--danger)', display: 'block', marginTop: '4px', fontSize: '0.8rem'}}>{emailMsg}</small>}
              </div>
              <div className="form-group" style={{position: 'relative', gridColumn: '1 / -1'}}>
                <Phone size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type="tel" name="mobileNumber" placeholder="Mobile Number" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', borderRadius: '8px'}} />
              </div>
              <div className="form-group" style={{position: 'relative', gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type="text" name="otp" placeholder="6-Digit Verification Code" value={formData.otp} onChange={handleChange} style={{flex: 1, padding: '0.75rem', paddingLeft: '40px', borderRadius: '8px', letterSpacing: '2px', fontWeight: 'bold'}} maxLength={6} />
                <button type="button" className="btn-secondary" onClick={() => handleSendSignupOtp()} disabled={isLoading} style={{padding: '0.75rem', cursor: isLoading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                   {isLoading ? <Loader2 className="spin-animation" size={18} /> : 'Email OTP'}
                </button>
              </div>
              
              <button type="button" onClick={handleVerifyOtpAndProceed} disabled={isLoading} className="btn-primary" style={{gridColumn: '1 / -1', padding: '0.75rem', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'wait' : 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                {isLoading ? <Loader2 className="spin-animation" size={18} /> : 'Verify & Proceed to Phase 2'}
              </button>
            </div>
          )}

          {(isLogin || signupStep === 2) && (
            <>
              {!isLogin && <h4 style={{textAlign: 'center', marginBottom: '0.5rem', color: 'var(--accent-primary)'}}>Phase 2: Secure Credentials</h4>}
              <div className="form-group" style={{position: 'relative'}}>
                <User size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type="text" name="username" placeholder="Unique Username" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', borderRadius: '8px'}} />
              </div>

              <div className="form-group" style={{position: 'relative'}}>
                <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type={showPassword ? "text" : "password"} name="password" placeholder="Password (Min 8 Characters)" onChange={handleChange} required minLength={8} style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', paddingRight: '40px', borderRadius: '8px'}} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '12px', top: '10px', color: 'var(--text-secondary)', background: 'transparent', padding: 0}}>
                   {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>

              {!isLogin && (
                <div className="form-group" style={{position: 'relative'}}>
                  <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                  <input type={showPassword ? "text" : "password"} name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required minLength={8} style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', paddingRight: '40px', borderRadius: '8px'}} />
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={isLoading} style={{width: '100%', padding: '0.75rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'wait' : 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                {isLoading ? <Loader2 className="spin-animation" size={20} /> : (isLogin ? 'Authenticate' : 'Complete Registration')}
              </button>
              {!isLogin && (
                <button type="button" onClick={() => setSignupStep(1)} style={{width: '100%', marginTop: '0.5rem', padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer'}}>
                  ← Back to Details
                </button>
              )}
            </>
          )}

          {!isLogin && signupStep === 3 && (
            <div className="animate-fade-in" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <h4 style={{textAlign: 'center', marginBottom: '0.5rem', color: 'var(--success)'}}>Google Validated! Secure Identity Needed.</h4>
              <div className="form-group" style={{position: 'relative'}}>
                <User size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type="text" name="username" placeholder="Create Unique Username" onChange={handleChange} required style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', borderRadius: '8px'}} />
              </div>
              <div className="form-group" style={{position: 'relative'}}>
                <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type={showPassword ? "text" : "password"} name="password" placeholder="Password (Min 8 Characters)" onChange={handleChange} required minLength={8} style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', paddingRight: '40px', borderRadius: '8px'}} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '12px', top: '10px', color: 'var(--text-secondary)', background: 'transparent', padding: 0}}>
                   {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
              <div className="form-group" style={{position: 'relative'}}>
                <Lock size={18} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)'}} />
                <input type={showPassword ? "text" : "password"} name="confirmPassword" placeholder="Confirm Password" onChange={handleChange} required minLength={8} style={{width: '100%', padding: '0.75rem', paddingLeft: '40px', paddingRight: '40px', borderRadius: '8px'}} />
              </div>
              <button type="submit" className="btn-primary" disabled={isLoading} style={{width: '100%', padding: '0.75rem', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'wait' : 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                {isLoading ? <Loader2 className="spin-animation" size={20} /> : 'Complete Google Registration'}
              </button>
            </div>
          )}
        </form>

        {isLogin && (
          <div style={{marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '2rem'}}>
             <button type="button" onClick={() => setIsForgotUsername(true)} style={{color: 'var(--text-secondary)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem'}}>
               Forgot Username?
             </button>
             <button type="button" onClick={() => setIsForgotPassword(true)} style={{color: 'var(--accent-primary)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem'}}>
               Forgot Password?
             </button>
          </div>
        )}

        <div style={{marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
           <div style={{display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginBottom: '1rem'}}>
               <div style={{flex: 1, height: '1px', background: 'var(--border)'}} />
               <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>OR</span>
               <div style={{flex: 1, height: '1px', background: 'var(--border)'}} />
           </div>
           
           <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
             <GoogleLogin 
               onSuccess={handleGoogleSuccess}
               onError={() => toast.error('Google Login Popup failed or was closed.')}
               shape="pill"
             />
           </div>
        </div>
      </div>
    </div>
  );
}
