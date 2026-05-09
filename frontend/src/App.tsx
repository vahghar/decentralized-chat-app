import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import { useChatStore } from './store';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

function App() {
  const { user, setUser, theme } = useChatStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const initE2E = async () => {
      const { CryptoService } = await import('./services/crypto');
      let id = await CryptoService.getIdentity();
      if (!id) {
        id = await CryptoService.generateKeyPair();
        await CryptoService.saveIdentity(id);
      }
      useChatStore.getState().setIdentity(id);

      // Publish public key to server if we have a user
      if (user) {
        const pub = await CryptoService.exportPublicKey(id.publicKey);
        await axios.post('http://localhost:5000/api/users/update-key', { publicKey: pub }, { withCredentials: true });
      }
    };
    initE2E();

    const syncUser = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/auth/me', { withCredentials: true });
        if (res.data.user) {
          setUser(res.data.user);
        }
      } catch (e) {
        setUser(null);
      }
    };
    if (user) syncUser();
  }, [user?.id]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '12px',
        }
      }} />
      <Routes>
        <Route path="/" element={!user ? <Landing /> : <Navigate to="/chat" />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/chat" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/chat" />} />
        <Route path="/chat" element={user ? <AppLayout /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
