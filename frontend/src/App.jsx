import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import DarkRoom from './pages/DarkRoom';
import Evaporator from './pages/Evaporator';
import ProfilePage from './pages/ProfilePage';
import NotFound from './pages/NotFound';
import api from './api';
import './index.css';
import { ToastProvider } from './context/ToastContext';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/auth" />;
}

function GlobalHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (localStorage.getItem('token')) {
        api.post('/users/heartbeat').catch(()=>{});
      }
    };
    ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, []);
  return null;
}

function PageTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-fade-in">
      {children}
    </div>
  );
}


function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
      <ToastProvider>
        <BrowserRouter>
          <GlobalHeartbeat />
          <PageTransition>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route 
                path="/dashboard/*" 
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <PrivateRoute>
                    <ProfilePage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/chat/:chatRequestId" 
                element={
                  <PrivateRoute>
                    <ChatPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/darkroom" 
                element={
                  <PrivateRoute>
                    <DarkRoom />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/evaporator" 
                element={
                  <PrivateRoute>
                    <Evaporator />
                  </PrivateRoute>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </BrowserRouter>
      </ToastProvider>
    </GoogleOAuthProvider>

  );
}

export default App;
