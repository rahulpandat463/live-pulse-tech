// App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ChartBar, AlertTriangle, Play, Pause, RefreshCw, ChevronDown, Activity, Users, CreditCard } from 'lucide-react';
import useWebSocket from './hooks/useWebSocket';
import Analytics from './pages/Analytics';
import Anomalies from './pages/Anomalies';

// API Configuration - relative to support proxy and docker
const API_BASE_URL = '/api';
const WS_URL = `ws://${window.location.host.split(':')[0]}:3001`; // Keep 3001 for WS as proxying WS is more complex

const App = () => {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'analytics', 'anomalies'
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulatorStatus, setSimulatorStatus] = useState('running');
  const [simulatorSpeed, setSimulatorSpeed] = useState(1);

  const { isConnected, lastMessage } = useWebSocket(WS_URL);

  // Fetch initial gyms and all-gym aggregates
  const fetchGyms = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/gyms`);
      setGyms(response.data);
      if (!selectedGymId && response.data.length > 0) {
        setSelectedGymId(response.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching gyms:', err);
    }
  }, [selectedGymId]);

  // Fetch live snapshot for selected gym
  const fetchLiveSnapshot = useCallback(async () => {
    if (!selectedGymId) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/gyms/${selectedGymId}/live`);
      setLiveData(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching live snapshot:', err);
      setLoading(false);
    }
  }, [selectedGymId]);

  // Fetch active anomalies
  const fetchAnomalies = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/anomalies`);
      setAnomalies(response.data);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
    }
  }, []);

  useEffect(() => {
    fetchGyms();
    fetchAnomalies();
  }, [fetchGyms, fetchAnomalies]);

  useEffect(() => {
    fetchLiveSnapshot();
  }, [fetchLiveSnapshot]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, gym_id, current_occupancy, today_total, amount, member_name, timestamp } = lastMessage;

    // Update global gyms list for aggregates
    setGyms(prevGyms => prevGyms.map(g => {
      if (g.id === gym_id) {
        if (type === 'CHECKIN_EVENT' || type === 'CHECKOUT_EVENT') {
          return { ...g, current_occupancy };
        }
        if (type === 'PAYMENT_EVENT') {
          return { ...g, today_revenue: today_total };
        }
      }
      return g;
    }));

    // Update live data if current gym is affected
    if (selectedGymId === gym_id) {
      setLiveData(prev => {
        if (!prev) return prev;
        
        const newEvents = [{ type, member_name, timestamp }, ...prev.recent_events].slice(0, 20);
        
        if (type === 'CHECKIN_EVENT' || type === 'CHECKOUT_EVENT') {
          return { ...prev, current_occupancy, recent_events: newEvents };
        }
        if (type === 'PAYMENT_EVENT') {
          return { ...prev, today_revenue: today_total, recent_events: newEvents };
        }
        return prev;
      });
    }

    if (type === 'ANOMALY_DETECTED') {
      fetchAnomalies();
      // Potentially show a toast notification here
    }
    if (type === 'ANOMALY_RESOLVED') {
      fetchAnomalies();
    }
  }, [lastMessage, selectedGymId, fetchAnomalies]);

  // Aggregates
  const stats = useMemo(() => {
    const totalOccupancy = gyms.reduce((sum, g) => sum + parseInt(g.current_occupancy || 0), 0);
    const totalRevenue = gyms.reduce((sum, g) => sum + parseFloat(g.today_revenue || 0), 0);
    const activeAnomalies = anomalies.length;
    return { totalOccupancy, totalRevenue, activeAnomalies };
  }, [gyms, anomalies]);

  const selectedGym = useMemo(() => gyms.find(g => g.id === selectedGymId), [gyms, selectedGymId]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d1a] text-[#e2e8f0]">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-[#2d2d44] bg-[#0d0d1a]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ff4d00] rounded-lg flex items-center justify-center shrink-0">
              <Activity className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase">LivePulse</h1>
          </div>
          
          <div className="h-6 w-px bg-[#2d2d44]" />
          
          <div className="relative group">
            <select 
              value={selectedGymId || ''} 
              onChange={(e) => setSelectedGymId(e.target.value)}
              className="appearance-none bg-[#1a1a2e] border border-[#2d2d44] rounded-lg px-4 py-2 pr-10 text-sm font-semibold focus:outline-none focus:border-[#ff4d00]/50 transition-all cursor-pointer"
            >
              {gyms.map(gym => (
                <option key={gym.id} value={gym.id}>{gym.name} - {gym.city}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b] pointer-events-none" />
          </div>

          <div className="h-6 w-px bg-[#2d2d44]" />

          <div className="flex items-center gap-1 bg-[#1a1a2e] p-1 rounded-lg border border-[#2d2d44]">
             {['dashboard', 'analytics', 'anomalies'].map(v => (
               <button 
                 key={v}
                 onClick={() => setView(v)}
                 className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all
                   ${view === v ? 'bg-[#ff4d00]/10 text-[#ff4d00]' : 'text-[#64748b] hover:text-[#e2e8f0]'}`}
               >
                 {v}
               </button>
             ))}
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Aggregates */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-[#64748b] uppercase text-[10px] font-bold">Total Occupancy</span>
              <span className="font-mono text-[#e2e8f0]">{stats.totalOccupancy}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[#64748b] uppercase text-[10px] font-bold">Today's Revenue</span>
              <span className="font-mono text-[#ff4d00]">₹{stats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="relative flex flex-col items-end">
              <span className="text-[#64748b] uppercase text-[10px] font-bold">Anomalies</span>
              <span className="font-mono text-[#ef4444] flex items-center gap-1">
                {stats.activeAnomalies}
                {stats.activeAnomalies > 0 && <AlertTriangle className="w-3 h-3 animate-pulse" />}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#2d2d44]" />

          {/* Connection Status */}
          <div className="flex items-center gap-2">
             <div className={`live-dot ${!isConnected ? 'disconnected' : ''}`} />
             <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
        {view === 'dashboard' && (
          <div className="grid grid-cols-12 gap-8">
            {/* KPI Row */}
            <div className="col-span-12 grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-4 dashboard-card flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="kpi-label">Current Occupancy</span>
                  <Users className="w-5 h-5 text-[#64748b]" />
                </div>
                <div className="flex items-end gap-3">
                  <motion.span 
                    key={liveData?.current_occupancy}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="kpi-value"
                  >
                    {liveData?.current_occupancy || 0}
                  </motion.span>
                  <span className="mb-2 text-[#64748b] font-mono text-sm">/ {selectedGym?.capacity} members</span>
                </div>
                <div className="mt-6 h-1 w-full bg-[#2d2d44] rounded-full overflow-hidden">
                  <motion.div 
                    className={`h-full ${((liveData?.current_occupancy / selectedGym?.capacity) * 100) > 85 ? 'bg-red-500' : ((liveData?.current_occupancy / selectedGym?.capacity) * 100) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${(liveData?.current_occupancy / selectedGym?.capacity) * 100}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(liveData?.current_occupancy / selectedGym?.capacity) * 100}%` }}
                  />
                </div>
              </div>

              <div className="col-span-12 md:col-span-4 dashboard-card flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="kpi-label">Today's Revenue</span>
                  <CreditCard className="w-5 h-5 text-[#64748b]" />
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-[#64748b] mb-1">₹</span>
                  <motion.span 
                    key={liveData?.today_revenue}
                    initial={{ scale: 1.1, color: '#ff4d00' }}
                    animate={{ scale: 1, color: '#e2e8f0' }}
                    className="kpi-value"
                  >
                    {liveData?.today_revenue?.toLocaleString()}
                  </motion.span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
                  <Activity className="w-3 h-3" />
                  <span className="font-bold">Real-time payment tracking active</span>
                </div>
              </div>

              <div className="col-span-12 md:col-span-4 dashboard-card flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="kpi-label">Active Anomalies</span>
                  <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <div className="flex items-center gap-4">
                  <span className={`kpi-value ${anomalies.length > 0 ? 'text-[#ef4444]' : 'text-green-500'}`}>
                    {anomalies.length}
                  </span>
                  {anomalies.length === 0 && <span className="text-sm font-semibold text-green-500">All systems optimal</span>}
                </div>
                <div className="mt-6 flex gap-2">
                  {anomalies.slice(0, 3).map((a, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'} animate-pulse`} />
                  ))}
                  {anomalies.length > 3 && <span className="text-[10px] text-[#64748b]">+{anomalies.length - 3} more</span>}
                </div>
              </div>
            </div>

            {/* Activity Feed and Simulator Controls */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              <div className="dashboard-card h-[500px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5 text-[#ff4d00]" />
                    <h2 className="font-bold uppercase tracking-widest text-sm">Real-Time Event Stream</h2>
                  </div>
                  <div className="text-[10px] uppercase tracking-tighter text-[#64748b] bg-[#2d2d44] px-2 py-1 rounded">
                    Auto-scrolling active
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-4">
                  <AnimatePresence initial={false}>
                    {liveData?.recent_events.map((event, i) => (
                      <motion.div 
                        key={`${event.timestamp}-${i}`}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center justify-between p-3 bg-[#0d0d1a]/50 rounded-lg border border-[#2d2d44]/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black
                            ${event.type === 'CHECKIN_EVENT' ? 'bg-green-500/10 text-green-500' : 
                              event.type === 'CHECKOUT_EVENT' ? 'bg-blue-500/10 text-blue-500' : 
                              'bg-[#ff4d00]/10 text-[#ff4d00]'}`}
                          >
                            {event.type === 'CHECKIN_EVENT' ? 'IN' : event.type === 'CHECKOUT_EVENT' ? 'OUT' : 'PAY'}
                          </div>
                          <div>
                            <div className="text-sm font-bold">{event.member_name}</div>
                            <div className="text-[10px] text-[#64748b] uppercase font-mono">
                              {new Date(event.timestamp).toLocaleTimeString()} • {event.type.replace('_EVENT', '')}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Sidebar: Simulator Controls */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              <div className="dashboard-card border-[#ff4d00]/20 bg-[#ff4d00]/5">
                <h2 className="text-[#ff4d00] font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" /> Simulator Engine
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        const next = simulatorStatus === 'running' ? 'stop' : 'start';
                        await axios.post(`${API_BASE_URL}/simulator/${next}`, { speed: simulatorSpeed });
                        setSimulatorStatus(next === 'start' ? 'running' : 'paused');
                      }}
                      className="flex-1 bg-[#ff4d00] hover:bg-[#ff4d00]/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {simulatorStatus === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {simulatorStatus === 'running' ? 'Pause' : 'Resume'}
                    </button>
                    <button 
                      onClick={async () => {
                        await axios.post(`${API_BASE_URL}/simulator/reset`);
                        fetchLiveSnapshot();
                      }}
                      className="w-14 bg-[#2d2d44] hover:bg-[#2d2d44]/80 text-white rounded-lg flex items-center justify-center transition-all"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[1, 5, 10].map(speed => (
                      <button 
                        key={speed}
                        onClick={async () => {
                          setSimulatorSpeed(speed);
                          if (simulatorStatus === 'running') await axios.post(`${API_BASE_URL}/simulator/start`, { speed });
                        }}
                        className={`flex-1 py-1 px-2 rounded border font-mono text-[10px] transition-all
                          ${simulatorSpeed === speed ? 'bg-[#ff4d00] border-[#ff4d00] text-white' : 'bg-[#1a1a2e] border-[#2d2d44] text-[#64748b]'}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dashboard-card">
                <h2 className="kpi-label mb-6 text-[10px]">Real-Time Stats</h2>
                <div className="space-y-3">
                  {gyms.filter(g => g.id !== selectedGymId).slice(0, 3).map(gym => (
                    <div key={gym.id} className="flex items-center justify-between text-xs py-2 border-b border-[#2d2d44]/50 last:border-0">
                      <span className="font-bold truncate w-24">{gym.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#64748b] flex items-center gap-1"><Users className="w-2.5 h-2.5" />{gym.current_occupancy}</span>
                        <span className="text-[#ff4d00] font-mono">₹{Math.round(gym.today_revenue || 0)}</span>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setView('analytics')} className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-[#ff4d00] hover:underline">
                    View Full Analytics →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'analytics' && <Analytics gymId={selectedGymId} gymName={selectedGym?.name} />}
        {view === 'anomalies' && <Anomalies />}
      </main>
    </div>
  );
};

export default App;
