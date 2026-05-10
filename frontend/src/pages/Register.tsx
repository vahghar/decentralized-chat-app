import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/auth/register`, { username, password });
      toast.success('Account created');
      navigate('/login');
    } catch { toast.error('Registration failed'); }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center" style={{ fontSize: 14 }}>
      <div className="w-80 bg-surface border border-border p-8">
        <div className="mb-8">
          <span className="mono text-base font-medium text-fg">3P</span>
          <p className="text-xs text-muted mt-1">Create a new account</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-xs text-muted mb-1.5">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
              className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-fg outline-none focus:border-fg transition-colors"
              placeholder="choose a username"
              style={{ color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-fg outline-none focus:border-fg transition-colors"
              placeholder="choose a password"
              style={{ color: 'var(--text)' }} />
          </div>
          <button type="submit"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
            className="w-full py-2.5 text-sm mt-2">
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Have an account? <Link to="/login" className="text-fg hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
