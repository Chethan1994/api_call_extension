
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface AdminPageProps {
  onBack: () => void;
  theme?: 'dark' | 'light';
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBack, theme = 'dark' }) => {
  const [users, setUsers] = useState<User[]>([]);
  const isDark = theme === 'dark';

  useEffect(() => {
    const savedUsers = JSON.parse(localStorage.getItem('nova_users') || '[]');
    setUsers(savedUsers);
  }, []);

  const deleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user profile?')) {
      const updated = users.filter(u => u.id !== userId);
      setUsers(updated);
      localStorage.setItem('nova_users', JSON.stringify(updated));
    }
  };

  const toggleRole = (userId: string) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        return { ...u, role: u.role === 'superadmin' ? 'user' : 'superadmin' } as User;
      }
      return u;
    });
    setUsers(updated);
    localStorage.setItem('nova_users', JSON.stringify(updated));
  };

  return (
    <div className={`flex-1 flex flex-col p-8 overflow-y-auto transition-colors ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Admin Control Center</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Manage local profiles and platform settings</p>
          </div>
          <button 
            onClick={onBack}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
              isDark ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm'
            }`}
          >
            <i className="fas fa-arrow-left mr-2"></i> Back to Studio
          </button>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8`}>
          {[
            { label: 'Total Users', value: users.length, icon: 'fa-users', color: 'text-blue-500' },
            { label: 'Active Sessions', value: '1 Local', icon: 'fa-bolt', color: 'text-yellow-500' },
            { label: 'Storage Used', value: (JSON.stringify(localStorage).length / 1024).toFixed(2) + ' KB', icon: 'fa-database', color: 'text-green-500' }
          ].map((stat, i) => (
            <div key={i} className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                </div>
                <div className={`${stat.color} opacity-20 text-3xl`}><i className={`fas ${stat.icon}`}></i></div>
              </div>
            </div>
          ))}
        </div>

        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'}`}>
          <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>User Management</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <th className="px-6 py-4">Profile</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {users.map((user) => (
                <tr key={user.id} className={`${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.email}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{user.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${
                      user.role === 'superadmin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-500 font-mono">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => toggleRole(user.id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-blue-400/10' : 'text-slate-400 hover:text-blue-600'}`}
                        title="Change Role"
                      >
                        <i className="fas fa-shield-alt"></i>
                      </button>
                      <button 
                        onClick={() => deleteUser(user.id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-red-500 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600'}`}
                        title="Delete Profile"
                        disabled={user.email === 'chethansg4@gmail.com'}
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-12 text-center">
              <i className="fas fa-users-slash text-4xl text-slate-800 mb-4"></i>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No local profiles found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};