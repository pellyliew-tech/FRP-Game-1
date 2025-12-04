import React, { useState, useEffect } from 'react';
import { Recruiter } from './types';
import { loginUser, getStoredData } from './storage';
import { Layout } from './Layout';
import { Login } from './Login';
import { Dashboard } from './Dashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Recruiter | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  useEffect(() => {
    // Check session on mount
    const savedId = sessionStorage.getItem('current_user_id');
    const savedAdmin = sessionStorage.getItem('is_admin');
    
    if (savedAdmin === 'true') {
        setIsAdmin(true);
        // For admin, we don't necessarily need a 'currentUser', but we can set a dummy or null
    } else if (savedId) {
      const all = getStoredData();
      const user = all.find(r => r.id === savedId);
      if (user) setCurrentUser(user);
    }
  }, []);

  const handleRecruiterLogin = (id: string) => {
    const user = loginUser(id);
    if (user) {
        sessionStorage.setItem('current_user_id', user.id);
        sessionStorage.removeItem('is_admin');
        setCurrentUser(user);
        setIsAdmin(false);
    }
  };

  const handleAdminLogin = () => {
      sessionStorage.setItem('is_admin', 'true');
      sessionStorage.removeItem('current_user_id');
      setIsAdmin(true);
      setCurrentUser(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('current_user_id');
    sessionStorage.removeItem('is_admin');
    setCurrentUser(null);
    setIsAdmin(false);
  };

  const triggerRefresh = () => {
    // Reload user data from LS if we are a specific user
    if (currentUser) {
        const all = getStoredData();
        const updated = all.find(r => r.id === currentUser.id);
        if (updated) setCurrentUser(updated);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Layout user={currentUser} isAdmin={isAdmin} onLogout={handleLogout}>
      {!currentUser && !isAdmin ? (
        <Login onRecruiterLogin={handleRecruiterLogin} onAdminLogin={handleAdminLogin} />
      ) : (
        <Dashboard 
            currentUser={currentUser} 
            isAdmin={isAdmin}
            onRefreshData={triggerRefresh} 
            key={refreshTrigger} 
        />
      )}
    </Layout>
  );
}