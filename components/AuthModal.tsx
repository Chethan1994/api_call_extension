
import React, { useState } from 'react';
import { User } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onAuth: (user: User) => void;
  theme?: 'dark' | 'light';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuth, theme = 'dark' }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const isDark = theme === 'dark';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    const savedUsers = JSON.parse(localStorage.getItem('nova_users') || '[]');

    if (isLogin) {
      const user = savedUsers.find((u: User) => u.username === username && u.password === password);
      if (user) {
        onAuth(user);
        onClose();
      } else {
        setError('Invalid username or password');
      }
    } else {
      if (savedUsers.find((u: User) => u.username === username)) {
        setError('Username already exists');
        return;
      }
      const newUser: User = { username, password };
      savedUsers.push(newUser);
      localStorage.setItem('nova_users', JSON.stringify(savedUsers));
      onAuth(newUser);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className={`border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-blue-500/40">N</div>
          </div>
          <h2 className={`text-center text-xl font-black mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {isLogin ? 'Welcome Back' : 'Create Local Profile'}
          </h2>
          <p className="text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-8">Data remains local on your device</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                placeholder="developer_01"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Local Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                placeholder="••••••••"
              />
            </div>
            
            {error && <p className="text-red-500 text-[10px] font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              {isLogin ? 'LOG IN' : 'CREATE PROFILE'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-[10px] font-bold text-slate-500 hover:text-blue-500 uppercase tracking-widest transition-colors"
            >
              {isLogin ? "Don't have a profile? Create one" : "Already have a profile? Log in"}
            </button>
          </div>
        </div>
        
        <div className="px-8 py-4 bg-slate-950/20 border-t border-slate-800 flex justify-center">
          <button onClick={onClose} className="text-[10px] text-slate-600 hover:text-slate-400 font-bold uppercase tracking-widest">Cancel</button>
        </div>
      </div>
    </div>
  );
};
