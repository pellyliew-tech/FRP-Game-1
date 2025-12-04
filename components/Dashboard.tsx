import React, { useState, useEffect, useMemo } from 'react';
import { Recruiter, CampaignConfig } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getStoredData, syncApplicantCount, addManualApplicants, updateRecruiterName, updateWeeklyCount, addNewRecruiter, getCampaignConfig, saveCampaignConfig, getRecruiterCampaignScore, getRecruiterWeeklyScore } from '../services/storage';
import { getCoachingTip, analyzePortalData } from '../services/gemini';

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
  const [modalType, setModalType] = useState<'UPDATE' | 'CREATE' | 'SETTINGS' | 'CALCULATOR'>('UPDATE');
  const [loading, setLoading] = useState(false);
  
  const [aiTip, setAiTip] = useState<string>('');
  
  // Update Modal Inputs
  const [updateMode, setUpdateMode] = useState<'SYNC_TOTAL' | 'ADD_MANUAL' | 'AI_SCAN'>('SYNC_TOTAL');
  const [inputValue, setInputValue] = useState<string>('');
  const [pasteData, setPasteData] = useState<string>('');
  const [aiResult, setAiResult] = useState<{ count: number, reasoning: string } | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Create Modal Inputs
  const [newParticipantName, setNewParticipantName] = useState('');

  // Settings Modal Inputs
  const [settingStart, setSettingStart] = useState('');
  const [settingEnd, setSettingEnd] = useState('');
  const [weeklyStart, setWeeklyStart] = useState('');
  const [weeklyEnd, setWeeklyEnd] = useState('');
  
  // Calculator Inputs
  const [calcRate, setCalcRate] = useState<number>(50); // Default $50 per applicant
  
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
    }
  }, [editingRecruiter, modalType]);

  // Calculate the difference based on input
  const differencePreview = useMemo(() => {
    if (!editingRecruiter || modalType !== 'UPDATE') return 0;
    
    let val = 0;
    
    if (updateMode === 'AI_SCAN' && aiResult) {
        val = aiResult.count;
    } else {
        val = parseInt(inputValue, 10);
    }

    if (isNaN(val)) return 0;

    if (updateMode === 'ADD_MANUAL') {
        return val;
    } else {
        // For Sync (Manual or AI), difference is New - Current
        return val - editingRecruiter.applicants.length;
    }
  }, [inputValue, updateMode, editingRecruiter, modalType, aiResult]);

  const handleAnalyze = async () => {
      if (!pasteData.trim()) return;
      setLoading(true);
      const result = await analyzePortalData(pasteData);
      setAiResult(result);
      setLoading(false);
  };

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

              // 2. Update Score
              let val = parseInt(inputValue, 10);
              
              if (updateMode === 'AI_SCAN' && aiResult) {
                  val = aiResult.count;
                  // AI Scan is a "Sync" operation
                  syncApplicantCount(editingRecruiter.id, val, selectedDate);
                  changesMade = true;
              } else if (!isNaN(val)) {
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
          setPasteData('');
          setAiResult(null);
          setNewParticipantName('');
          setShowSqlHelp(false);
      }, 600);
  };

  const openUpdateModal = (recruiterId?: string) => {
      setModalType('UPDATE');
      setInputValue('');
      setPasteData('');
      setAiResult(null);
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

  const openCalculatorModal = () => {
    setModalType('CALCULATOR');
    setIsModalOpen(true);
  }

  const rank = currentUser ? allRecruiters.findIndex(r => r.id === currentUser.id) + 1 : 0;
  
  // Calculate Campaign Totals
  const totalCampaignApplicants = allRecruiters.reduce((acc, curr) => acc + getRecruiterCampaignScore(curr, config), 0);
  const myCampaignScore = currentUser ? getRecruiterCampaignScore(currentUser, config) : 0;

  // Validation logic
  const currentCount = editingRecruiter ? editingRecruiter.applicants.length : 0;
  
  let finalTotal = 0;
  let isScoreValid = false;

  if (updateMode === 'AI_SCAN') {
      isScoreValid = !!aiResult && aiResult.count >= 0;
      finalTotal = aiResult ? aiResult.count : 0;
  } else {
      const inputValNum = parseInt(inputValue, 10);
      finalTotal = updateMode === 'ADD_MANUAL' ? currentCount + inputValNum : inputValNum;
      isScoreValid = !isNaN(inputValNum) && finalTotal >= 0;
  }
  
  const isNameChanged = isAdmin && editName !== editingRecruiter?.name && editName.trim() !== '';
  
  const canSubmit = !loading && (
      modalType === 'SETTINGS' ? (settingStart !== '' && settingEnd !== '') :
      modalType === 'CREATE' ? newParticipantName.trim().length > 0 :
      modalType === 'CALCULATOR' ? false : // Calculator doesn't have a submit
      (isScoreValid || isNameChanged)
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
            <div className="flex items-center justify-between">
                <p className="text-5xl font-bold text-white mt-2">
                    {isAdmin ? totalCampaignApplicants : myCampaignScore}
                </p>
                {/* Calculator Button */}
                {!isAdmin && (
                    <button 
                        onClick={openCalculatorModal}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-emerald-400 transition-colors"
                        title="Calculate Commission"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </button>
                )}
            </div>
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

      {/* Admin Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">
                        {modalType === 'CREATE' ? 'Add New Participant' : 
                         modalType === 'SETTINGS' ? 'Campaign Settings' : 
                         modalType === 'CALCULATOR' ? 'Commission Calculator' : 'Portal Sync'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {modalType === 'SETTINGS' ? (
                        /* SETTINGS FORM */
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-white border-b border-slate-700 pb-2">Campaign Duration</h4>
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
                            </div>
                            
                             <button
                                onClick={handleUpdateScore}
                                disabled={!canSubmit}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading ? 'Creating...' : 'Create Participant'}
                            </button>
                        </div>
                    ) : modalType === 'CALCULATOR' ? (
                        /* COMMISSION CALCULATOR FORM */
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center">
                                <p className="text-slate-400 text-sm mb-1 uppercase font-bold">Your Total Score</p>
                                <p className="text-4xl font-bold text-white">{myCampaignScore}</p>
                            </div>

                            <div>
                                <label className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-2 block">Commission Rate (per Applicant)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
                                    <input 
                                        type="number"
                                        value={calcRate}
                                        onChange={(e) => setCalcRate(Number(e.target.value))}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-xl flex flex-col items-center">
                                <p className="text-emerald-400 text-sm mb-2 uppercase font-bold">Potential Earnings</p>
                                <p className="text-5xl font-bold text-white tracking-tight">
                                    ${(myCampaignScore * calcRate).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* UPDATE EXISTING RECRUITER FORM */
                        editingRecruiter && (
                        <>
                            {/* Toggle Mode */}
                            <div className="flex bg-slate-900 p-1 rounded-xl mb-6 border border-slate-700">
                                <button 
                                    onClick={() => { setUpdateMode('SYNC_TOTAL'); setInputValue(''); }}
                                    className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${updateMode === 'SYNC_TOTAL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Number Sync
                                </button>
                                <button 
                                    onClick={() => { setUpdateMode('AI_SCAN'); setPasteData(''); setAiResult(null); }}
                                    className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${updateMode === 'AI_SCAN' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    AI Portal Scan
                                </button>
                                <button 
                                    onClick={() => { setUpdateMode('ADD_MANUAL'); setInputValue(''); }}
                                    className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${updateMode === 'ADD_MANUAL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    +/- Manual
                                </button>
                            </div>

                            {updateMode === 'AI_SCAN' ? (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-xs text-indigo-300">
                                        <strong>Instructions:</strong> Go to your recruiter portal, select your applicant list (rows, tables, or text), copy it, and paste it below. AI will count valid entries for you.
                                    </div>
                                    <textarea
                                        value={pasteData}
                                        onChange={(e) => setPasteData(e.target.value)}
                                        placeholder="Paste copied data here (e.g. Applicant Name | Date | Status)..."
                                        className="w-full h-32 bg-slate-900 border border-slate-600 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                                    />
                                    
                                    {!aiResult ? (
                                        <button 
                                            onClick={handleAnalyze}
                                            disabled={loading || !pasteData.trim()}
                                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            {loading ? 'Analyzing...' : 'Analyze Data'}
                                        </button>
                                    ) : (
                                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-slate-400 text-sm">Found Applicants:</span>
                                                <span className="text-2xl font-bold text-white">{aiResult.count}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 italic border-t border-slate-700 pt-2">"{aiResult.reasoning}"</p>
                                            
                                            <div className="mt-3 bg-emerald-900/30 p-2 rounded border border-emerald-500/20 text-center">
                                                <span className="text-emerald-400 text-xs font-bold uppercase block mb-1">Estimated Commission</span>
                                                <span className="text-lg font-bold text-white">${(aiResult.count * 50).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Existing Manual/Sync Input */
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                        <span className="text-sm text-slate-400">Current Total:</span>
                                        <span className="text-xl font-bold text-white">{editingRecruiter.applicants.length}</span>
                                    </div>
                                    
                                    <div className="relative">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 block">
                                            {updateMode === 'SYNC_TOTAL' ? 'New Total from SQL' : 'Amount to Add/Remove'}
                                        </label>
                                        <input 
                                            type="number" 
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder={updateMode === 'SYNC_TOTAL' ? editingRecruiter.applicants.length.toString() : "0"}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-2xl font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-700"
                                        />
                                    </div>

                                    {/* Feedback Area */}
                                    {differencePreview !== 0 && (
                                        <div className={`rounded-lg p-4 flex items-center gap-3 ${differencePreview > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg ${differencePreview > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                                {differencePreview > 0 ? '+' : '-'}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${differencePreview > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {differencePreview > 0 ? `Adds ${differencePreview} applicants` : `Removes ${Math.abs(differencePreview)} applicants`}
                                                </p>
                                                <p className={`text-xs opacity-70 ${differencePreview > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    Est. Commission Effect: ${ (differencePreview * 50).toLocaleString() }
                                                </p>
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
                                {loading ? 'Updating...' : updateMode === 'AI_SCAN' ? 'Confirm AI Sync' : 'Confirm Update'}
                            </button>
                        </>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};