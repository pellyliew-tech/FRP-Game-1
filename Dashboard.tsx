import React, { useState, useEffect, useMemo } from 'react';
import { Recruiter, CampaignConfig } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getStoredData, syncApplicantCount, addManualApplicants, updateRecruiterName, updateWeeklyCount, addNewRecruiter, getCampaignConfig, saveCampaignConfig, getRecruiterCampaignScore, getRecruiterWeeklyScore } from './storage';
import { getCoachingTip } from './gemini';

interface DashboardProps {
  currentUser: Recruiter | null; // Can be null if Admin
  isAdmin: boolean;
  onRefreshData: () => void;
}

const CAMPAIGN_SQL = `SELECT unique_apply AS unique_apply
FROM
  (select count(distinct(talent_id))-108-78-91-83-50-69-72 as unique_apply
   from talent_task
   where apply_date is not null
     and created_at>'2025-10-03T00:00:00'
     and (talent_id in
            (select talent_id
             from talent_resume
             where raw_data is not null
               and raw_data != ''
               and (raw_data like '%mandarin%'
                    or raw_data like '%chinese%'))
          OR talent_id in
            (select id
             from talents
             where is_chinese_name =1))) AS virtual_table
LIMIT 10000;`;

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, isAdmin, onRefreshData }) => {
  const [allRecruiters, setAllRecruiters] = useState<Recruiter[]>([]);
  const [config, setConfig] = useState<CampaignConfig>({ startDate: '', endDate: '' });
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'UPDATE' | 'CREATE' | 'SETTINGS'>('UPDATE');
  const [loading, setLoading] = useState(false);
  
  const [aiTip, setAiTip] = useState<string>('');
  
  // Update Modal Inputs
  const [updateMode, setUpdateMode] = useState<'SYNC_TOTAL' | 'ADD_MANUAL'>('SYNC_TOTAL');
  const [inputValue, setInputValue] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editWeeklyCount, setEditWeeklyCount] = useState<string>(''); // Not used but kept for legacy
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Create Modal Inputs
  const [newParticipantName, setNewParticipantName] = useState('');

  // Settings Modal Inputs
  const [settingStart, setSettingStart] = useState('');
  const [settingEnd, setSettingEnd] = useState('');
  const [weeklyStart, setWeeklyStart] = useState('');
  const [weeklyEnd, setWeeklyEnd] = useState('');
  
  // Admin: Which user is being updated?
  const [targetUserId, setTargetUserId] = useState<string>('');

  useEffect(() => {
    // Load config first
    const cfg = getCampaignConfig();
    setConfig(cfg);
    
    // Load Data
    const data = getStoredData();
    // Sort by Campaign Score (not absolute total)
    data.sort((a, b) => getRecruiterCampaignScore(b, cfg) - getRecruiterCampaignScore(a, cfg));
    
    setAllRecruiters(data);
    
    if (currentUser && data.length > 0) {
        // Find the top leader based on campaign score
        const leader = data[0]; 
        if (leader.id !== currentUser.id) {
            getCoachingTip(currentUser, leader).then(setAiTip);
        } else {
             setAiTip("You are in the lead! Keep the momentum going to secure the prize!");
        }
    } else if (currentUser) {
        setAiTip("You are in the lead! Keep the momentum going to secure the prize!");
    } else if (isAdmin) {
        setAiTip("As Admin, ensure all scores are synced daily by 5 PM.");
    }
  }, [currentUser, isAdmin, onRefreshData]);

  // Determine which data to show on chart based on Dynamic Date Range
  const chartData = useMemo(() => {
    if (!config.startDate || !config.endDate) return [];

    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    
    // Generate array of days between start and end
    const dailyData = [];
    const loop = new Date(start);
    
    while (loop <= end) {
        const month = loop.toLocaleString('default', { month: 'short' });
        const day = loop.getDate();
        dailyData.push({
            fullDate: loop.toISOString().split('T')[0], // YYYY-MM-DD
            label: `${month} ${day}`,
            count: 0
        });
        loop.setDate(loop.getDate() + 1);
    }

    // If admin, aggregate everyone. If user, just them.
    const sourceRecruiters = isAdmin ? allRecruiters : (currentUser ? [currentUser] : []);

    sourceRecruiters.forEach(recruiter => {
        recruiter.applicants.forEach(app => {
            const appDate = app.appliedDate.split('T')[0];
            const dayEntry = dailyData.find(d => d.fullDate === appDate);
            if (dayEntry) {
                dayEntry.count += 1;
            }
        });
    });

    return dailyData;
  }, [currentUser, allRecruiters, isAdmin, config]);

  // Who are we editing?
  const editingRecruiter = useMemo(() => {
     if (!isAdmin) return currentUser;
     return allRecruiters.find(r => r.id === targetUserId) || null;
  }, [isAdmin, currentUser, allRecruiters, targetUserId]);

  // Sync inputs when editor changes
  useEffect(() => {
    if (editingRecruiter && modalType === 'UPDATE') {
        setEditName(editingRecruiter.name);
        setEditWeeklyCount(editingRecruiter.weeklyCount.toString());
    }
  }, [editingRecruiter, modalType]);

  // Calculate the difference based on input
  const differencePreview = useMemo(() => {
    if (!editingRecruiter || modalType !== 'UPDATE') return 0;
    const val = parseInt(inputValue, 10);
    if (isNaN(val)) return 0;

    if (updateMode === 'ADD_MANUAL') {
        return val;
    } else {
        return val - editingRecruiter.applicants.length;
    }
  }, [inputValue, updateMode, editingRecruiter, modalType]);

  const handleUpdateScore = () => {
      setLoading(true);
      
      setTimeout(() => {
          let changesMade = false;

          if (modalType === 'SETTINGS') {
              if (settingStart && settingEnd) {
                  const newConfig = { 
                      startDate: settingStart, 
                      endDate: settingEnd,
                      weeklyStartDate: weeklyStart || undefined,
                      weeklyEndDate: weeklyEnd || undefined
                  };
                  saveCampaignConfig(newConfig);
                  setConfig(newConfig);
                  changesMade = true;
              }
          } else if (modalType === 'CREATE') {
              if (newParticipantName.trim()) {
                  addNewRecruiter(newParticipantName.trim());
                  changesMade = true;
              }
          } else if (editingRecruiter) {
              // 1. Update Name if changed
              if (isAdmin && editName && editName !== editingRecruiter.name) {
                  updateRecruiterName(editingRecruiter.id, editName);
                  changesMade = true;
              }

              // 2. Update Score if value entered
              const val = parseInt(inputValue, 10);
              if (!isNaN(val)) {
                  if (updateMode === 'ADD_MANUAL') {
                      addManualApplicants(editingRecruiter.id, val, selectedDate);
                  } else {
                      syncApplicantCount(editingRecruiter.id, val, selectedDate);
                  }
                  changesMade = true;
              }
          }

          if (changesMade) {
              onRefreshData();
          }

          setLoading(false);
          setIsModalOpen(false);
          setInputValue('');
          setNewParticipantName('');
          setShowSqlHelp(false);
      }, 600);
  };

  const openUpdateModal = (recruiterId?: string) => {
      setModalType('UPDATE');
      setInputValue('');
      setUpdateMode('SYNC_TOTAL');
      if (isAdmin && recruiterId) {
          setTargetUserId(recruiterId);
      } else if (isAdmin && allRecruiters.length > 0) {
          setTargetUserId(allRecruiters[0].id); // Default to first
      }
      setIsModalOpen(true);
  };

  const openCreateModal = () => {
      setModalType('CREATE');
      setNewParticipantName('');
      setIsModalOpen(true);
  };

  const openSettingsModal = () => {
      setModalType('SETTINGS');
      setSettingStart(config.startDate);
      setSettingEnd(config.endDate);
      setWeeklyStart(config.weeklyStartDate || '');
      setWeeklyEnd(config.weeklyEndDate || '');
      setIsModalOpen(true);
  }

  const rank = currentUser ? allRecruiters.findIndex(r => r.id === currentUser.id) + 1 : 0;
  
  // Calculate Campaign Totals
  const totalCampaignApplicants = allRecruiters.reduce((acc, curr) => acc + getRecruiterCampaignScore(curr, config), 0);
  const myCampaignScore = currentUser ? getRecruiterCampaignScore(currentUser, config) : 0;

  // Validation logic
  const currentCount = editingRecruiter ? editingRecruiter.applicants.length : 0;
  const inputValNum = parseInt(inputValue, 10);
  
  const finalTotal = updateMode === 'ADD_MANUAL' 
    ? currentCount + inputValNum 
    : inputValNum;

  const isScoreValid = !isNaN(inputValNum) && finalTotal >= 0;
  const isNameChanged = isAdmin && editName !== editingRecruiter?.name && editName.trim() !== '';
  
  const canSubmit = !loading && (
      modalType === 'SETTINGS' ? (settingStart !== '' && settingEnd !== '') :
      modalType === 'CREATE' ? newParticipantName.trim().length > 0 :
      ((inputValue !== '' && isScoreValid) || isNameChanged)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Score/Total */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                {isAdmin ? 'Total Campaign Applicants' : 'My Campaign Score'}
            </h3>
            <p className="text-5xl font-bold text-white mt-2">
                {isAdmin ? totalCampaignApplicants : myCampaignScore}
            </p>
            <div className="mt-4 flex items-center gap-2">
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded">
                   {config.startDate} to {config.endDate}
                </span>
                {isAdmin && <span className="text-slate-500 text-xs">Global Aggregate</span>}
            </div>
        </div>

        {/* Card 2: Rank/Status */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
            <h3 className="text-indigo-200 text-sm font-medium uppercase tracking-wider">
                {isAdmin ? 'Campaign Status' : 'Current Rank'}
            </h3>
            <div className="flex items-baseline gap-2 mt-2">
                {isAdmin ? (
                    <p className="text-3xl font-bold text-white">Active</p>
                ) : (
                    <>
                    <p className="text-5xl font-bold text-white">#{rank}</p>
                    <p className="text-slate-400 text-sm">of {allRecruiters.length}</p>
                    </>
                )}
            </div>
             {currentUser && rank === 1 && (
                <p className="text-amber-400 text-sm mt-3 font-semibold flex items-center gap-1">
                    👑 You are the Champion!
                </p>
            )}
            {isAdmin && (
                <p className="text-indigo-300 text-sm mt-3">
                    {allRecruiters.length} recruiters competing
                </p>
            )}
        </div>

        {/* Card 3: Tips/Admin Info */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col justify-between">
             <div>
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                    {isAdmin ? (
                        <><svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Admin Mode Active</>
                    ) : (
                        <><svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Coach's Tip</>
                    )}
                </h3>
                <p className="text-slate-100 italic mt-3 text-lg leading-relaxed">
                    "{aiTip}"
                </p>
             </div>
             {isAdmin && (
                 <button 
                    onClick={openSettingsModal}
                    className="mt-4 self-start flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors"
                 >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     Campaign Settings
                 </button>
             )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart Area */}
        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        {isAdmin ? 'Global Daily Performance' : 'My Performance Overview'}
                    </h2>
                    <p className="text-xs text-slate-400">{config.startDate} to {config.endDate}</p>
                </div>
            </div>
            
            <div className="flex-grow min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis 
                            dataKey="label" 
                            stroke="#94a3b8" 
                            tick={{fontSize: 10}} 
                            axisLine={false} 
                            tickLine={false}
                            interval="preserveStartEnd" 
                        />
                        <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <Tooltip 
                            cursor={{fill: '#334155', opacity: 0.4}}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#818cf8' : '#334155'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col h-full max-h-[600px]">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400 text-2xl">🏆</span> Leaderboard
                </h2>
                {isAdmin && (
                    <button 
                        onClick={openCreateModal}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Add Participant
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {allRecruiters.map((r, idx) => {
                    const isTop5 = idx < 5;
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                    const isCurrentUser = currentUser && r.id === currentUser.id;
                    const campaignScore = getRecruiterCampaignScore(r, config);
                    const weeklyScore = getRecruiterWeeklyScore(r, config);
                    
                    return (
                        <div 
                            key={r.id} 
                            className={`flex items-center p-4 rounded-xl border transition-all duration-300
                                ${isCurrentUser
                                    ? 'bg-indigo-900/40 border-indigo-500/50 shadow-indigo-500/10 shadow-lg translate-x-1' 
                                    : isTop5 
                                        ? 'bg-slate-700/30 border-slate-600/50' 
                                        : 'bg-slate-900/50 border-slate-800'
                                }
                                ${isTop5 && idx === 0 ? 'border-amber-500/30 bg-amber-900/10' : ''}
                            `}
                        >
                            <div className={`flex-shrink-0 w-8 text-center font-bold text-lg ${isTop5 ? 'text-white scale-110' : 'text-slate-500'}`}>
                                {medal || idx + 1}
                            </div>
                            
                            <div className="relative">
                                <img src={r.avatar} alt={r.name} className={`w-10 h-10 rounded-full mx-3 border-2 ${isTop5 ? 'border-indigo-400' : 'border-slate-600'}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${isCurrentUser ? 'text-indigo-300' : isTop5 ? 'text-white' : 'text-slate-300'}`}>
                                    {r.name} {isCurrentUser && '(You)'}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{r.company}</p>
                            </div>
                            
                            <div className="text-right pl-2 flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                     <span className={`block text-xl font-bold ${isTop5 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {campaignScore}
                                    </span>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => openUpdateModal(r.id)}
                                            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                                            title="Edit Score"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                    )}
                                </div>
                                {/* Weekly Badge */}
                                {config.weeklyStartDate && (
                                    <div className="bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/50">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Weekly:</span>
                                        <span className="text-xs font-bold text-white">{weeklyScore}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

      </div>

      {/* Admin Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">
                        {modalType === 'CREATE' ? 'Add New Participant' : modalType === 'SETTINGS' ? 'Campaign Settings' : 'Update Recruiter'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-8">
                    {modalType === 'SETTINGS' ? (
                        /* SETTINGS FORM */
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-white border-b border-slate-700 pb-2">Campaign Duration (Chart & Total Score)</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Start Date</label>
                                    <input 
                                        type="date"
                                        value={settingStart}
                                        onChange={(e) => setSettingStart(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">End Date</label>
                                    <input 
                                        type="date"
                                        value={settingEnd}
                                        onChange={(e) => setSettingEnd(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <h4 className="text-sm font-bold text-white border-b border-slate-700 pb-2 mt-6">Weekly Challenge (Badge Count)</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Weekly Start</label>
                                    <input 
                                        type="date"
                                        value={weeklyStart}
                                        onChange={(e) => setWeeklyStart(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Weekly End</label>
                                    <input 
                                        type="date"
                                        value={weeklyEnd}
                                        onChange={(e) => setWeeklyEnd(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>
                            
                            <p className="text-xs text-slate-500 mt-2">
                                Changing "Campaign Duration" adjusts the bar chart and total score. "Weekly Challenge" only updates the "Weekly:" badge number.
                            </p>
                            <button
                                onClick={handleUpdateScore}
                                disabled={!canSubmit}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    ) : modalType === 'CREATE' ? (
                        /* CREATE NEW PARTICIPANT FORM */
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Participant Name</label>
                                <input 
                                    type="text"
                                    value={newParticipantName}
                                    onChange={(e) => setNewParticipantName(e.target.value)}
                                    placeholder="Enter full name"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                    autoFocus
                                />
                                <p className="text-xs text-slate-500 mt-2">A default avatar will be generated based on the name.</p>
                            </div>
                            
                             <button
                                onClick={handleUpdateScore}
                                disabled={!canSubmit}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {loading ? 'Creating...' : 'Create Participant'}
                            </button>
                        </div>
                    ) : (
                        /* UPDATE EXISTING RECRUITER FORM */
                        editingRecruiter && (
                        <>
                            {/* Admin: Select User Dropdown */}
                            {isAdmin && (
                                <div className="mb-6 space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Recruiter to Update</label>
                                        <select 
                                            value={targetUserId}
                                            onChange={(e) => setTargetUserId(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                        >
                                            {allRecruiters.map(r => (
                                                <option key={r.id} value={r.id}>{r.name} (Current: {r.applicants.length})</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Recruiter Name</label>
                                            <input 
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                placeholder="Enter full name"
                                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Date Selection */}
                            <div className="mb-8">
                                <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Record Date</label>
                                <input 
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Toggle Mode */}
                            <div className="flex bg-slate-900 p-1 rounded-xl mb-6 border border-slate-700">
                                <button 
                                    onClick={() => { setUpdateMode('SYNC_TOTAL'); setInputValue(''); }}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${updateMode === 'SYNC_TOTAL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Sync Total (From SQL)
                                </button>
                                <button 
                                    onClick={() => { setUpdateMode('ADD_MANUAL'); setInputValue(''); }}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${updateMode === 'ADD_MANUAL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Add / Subtract
                                </button>
                            </div>

                            {updateMode === 'SYNC_TOTAL' ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                        <span className="text-sm text-slate-400">Current Total:</span>
                                        <span className="text-xl font-bold text-white">{editingRecruiter.applicants.length}</span>
                                    </div>
                                    
                                    <div className="relative">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">New Total from SQL</label>
                                        <input 
                                            type="number" 
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder={editingRecruiter.applicants.length.toString()}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-2xl font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-700"
                                        />
                                    </div>

                                    {/* Feedback Area */}
                                    {differencePreview > 0 && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">+</div>
                                            <div>
                                                <p className="text-emerald-400 font-bold text-sm">Update will add {differencePreview} applicants</p>
                                                <p className="text-emerald-500/70 text-xs">Total will become: {editingRecruiter.applicants.length + differencePreview}</p>
                                            </div>
                                        </div>
                                    )}
                                    {differencePreview < 0 && inputValue !== '' && (
                                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-lg">!</div>
                                            <p className="text-rose-400 font-bold text-sm">Warning: New total is lower than current.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">Number to Add (or - to deduct)</label>
                                        <input 
                                            type="number" 
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-2xl font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-700"
                                        />
                                    </div>
                                    {differencePreview > 0 && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">+</div>
                                            <div>
                                                <p className="text-emerald-400 font-bold text-sm">Adding {differencePreview} to {editingRecruiter.name}</p>
                                                <p className="text-emerald-500/70 text-xs">New Total: {editingRecruiter.applicants.length + differencePreview}</p>
                                            </div>
                                        </div>
                                    )}
                                    {differencePreview < 0 && (
                                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-lg">-</div>
                                            <div>
                                                <p className="text-rose-400 font-bold text-sm">Removing {Math.abs(differencePreview)} applicants</p>
                                                <p className="text-rose-500/70 text-xs">New Total: {Math.max(0, editingRecruiter.applicants.length + differencePreview)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleUpdateScore}
                                disabled={!canSubmit}
                                className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {loading ? 'Updating...' : 'Confirm Update'}
                            </button>

                            {updateMode === 'SYNC_TOTAL' && (
                                <div className="mt-6 w-full text-center">
                                    <button 
                                        onClick={() => setShowSqlHelp(!showSqlHelp)}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                                    >
                                        {showSqlHelp ? 'Hide SQL Query' : 'Where do I get this number?'}
                                    </button>
                                    
                                    {showSqlHelp && (
                                        <div className="mt-4 bg-black/30 rounded-lg p-3 border border-slate-700 animate-in fade-in text-left">
                                            <p className="text-[10px] text-slate-400 mb-2 uppercase font-bold">Copy & Run in Portal:</p>
                                            <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap selection:bg-indigo-500">
                                                {CAMPAIGN_SQL}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};