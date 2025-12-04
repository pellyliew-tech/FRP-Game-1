import React, { useEffect, useState } from 'react';
import { Recruiter } from './types';
import { getStoredData, getRecruiterCampaignScore, getCampaignConfig } from './storage';

interface LoginProps {
  onRecruiterLogin: (id: string) => void;
  onAdminLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onRecruiterLogin, onAdminLogin }) => {
  const [users, setUsers] = useState<Recruiter[]>([]);
  const [showAdminTrigger, setShowAdminTrigger] = useState(false);
  const [secretClickCount, setSecretClickCount] = useState(0);

  // Password Login State
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Configuration for displaying correct score
  const config = getCampaignConfig();

  useEffect(() => {
    const data = getStoredData();
    // Sort alphabetically for easier finding
    setUsers(data.sort((a, b) => a.name.localeCompare(b.name)));

    // Check for admin parameter in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        setShowAdminTrigger(true);
    }
  }, []);

  const handleSecretClick = () => {
    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);
    if (newCount >= 5) {
        setShowAdminTrigger(true);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
      e.preventDefault();
      // Simple hardcoded password for the campaign
      if (password === 'admin2025') {
          onAdminLogin();
      } else {
          setError('Incorrect password');
          setPassword('');
      }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10 select-none">
            <h1 
                onClick={handleSecretClick}
                className="text-4xl font-bold text-white mb-3 cursor-default active:scale-95 transition-transform"
            >
                Year-End Recruitment Race
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto">
                Select your profile to view your stats and current ranking.
            </p>
        </div>

        <div className="flex flex-col gap-8">
            {/* Recruiter Section */}
            <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700/50">
                <h2 className="text-xl font-bold text-slate-300 mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Leaderboard Participants
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {users.map((user) => {
                    const campaignScore = getRecruiterCampaignScore(user, config);
                    return (
                        <button
                        key={user.id}
                        onClick={() => onRecruiterLogin(user.id)}
                        className="group relative bg-slate-900 hover:bg-indigo-900/50 border border-slate-700 hover:border-red-500 rounded-xl p-4 flex flex-col items-center transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-red-500/20"
                        >
                        <div className="relative mb-3">
                            <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className="w-16 h-16 rounded-full bg-slate-700 object-cover border-2 border-slate-600 group-hover:border-red-400 transition-colors" 
                            />
                            <div className="absolute -bottom-1 -right-1 bg-slate-800 rounded-full px-1.5 py-0.5 border border-slate-600 text-[10px] text-slate-300 font-mono">
                            {campaignScore}
                            </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-200 group-hover:text-white text-center leading-tight">
                            {user.name}
                        </span>
                        </button>
                    );
                })}
                </div>
            </div>

            {/* Admin Section */}
            {showAdminTrigger && (
                <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4">
                     {!showPasswordInput ? (
                         <button 
                            onClick={() => setShowPasswordInput(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-all text-sm font-medium"
                         >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Access Admin Portal
                         </button>
                     ) : (
                         <form onSubmit={handleAdminAuth} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center gap-2 shadow-xl">
                            <input 
                                type="password" 
                                placeholder="Admin Password" 
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 w-48 text-sm"
                                autoFocus
                            />
                            <button 
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                Enter
                            </button>
                            {error && <span className="text-red-400 text-xs font-bold absolute -bottom-6 left-0 w-full text-center">{error}</span>}
                         </form>
                     )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};