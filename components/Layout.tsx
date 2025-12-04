import React from 'react';
import { Recruiter } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: Recruiter | null;
  isAdmin: boolean;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, isAdmin, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <nav className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              <span className="font-bold text-xl tracking-tight hidden sm:block">Year-End <span className="text-red-500">Recruitment Race</span></span>
              <span className="font-bold text-xl tracking-tight block sm:hidden">Recruitment <span className="text-red-500">Race</span></span>
            </div>
            {(user || isAdmin) && (
              <div className="flex items-center gap-4">
                {isAdmin && (
                    <span className="hidden md:inline-block bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                        Admin Mode
                    </span>
                )}
                <div className="flex items-center gap-2">
                   {user && (
                    <>
                        <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
                        <span className="text-sm font-medium hidden sm:block">{user.name}</span>
                    </>
                   )}
                </div>
                
                {/* Home / Logout Buttons */}
                <div className="flex items-center border-l border-slate-700 pl-4 ml-2 gap-3">
                    <button 
                        onClick={onLogout}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Back to Home / Switch User"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    </button>
                    <button 
                      onClick={onLogout}
                      className="text-sm text-slate-400 hover:text-red-400 transition-colors hidden sm:block"
                    >
                      Logout
                    </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-grow">
        {children}
      </main>
      <footer className="border-t border-slate-800 py-6 text-center text-slate-500 text-sm">
        <p>© 2025 Year-End Recruitment Race. Happy Hunting!</p>
      </footer>
    </div>
  );
};