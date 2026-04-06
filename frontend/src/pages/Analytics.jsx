// Analytics.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { Users, CreditCard, UserMinus, TrendingUp, Filter } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001/api';

const COLORS = ['#ff4d00', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];

const Analytics = ({ gymId, gymName }) => {
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!gymId) return;
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/analytics/gyms/${gymId}?dateRange=${dateRange}`);
        setData(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [gymId, dateRange]);

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
         <div className="w-12 h-12 border-4 border-[#ff4d00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Transform heatmap data for Recharts
  // Heatmap usually needs a grid, but Recharts can do it with a BarChart or a specialized Heatmap component.
  // We'll use a BarChart showing checkins by hour for the peak hours.
  const peakHoursData = Array.from({ length: 24 }, (_, i) => {
    const hourData = data.heatmap.filter(h => h.hour_of_day === i);
    const avgCheckins = hourData.length > 0 
      ? hourData.reduce((sum, h) => sum + parseInt(h.checkin_count), 0) / 7  // 7 days avg
      : 0;
    return { hour: `${i}:00`, count: Math.round(avgCheckins) };
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Analytics Deep-Dive</h2>
            <p className="text-sm text-[#64748b]">Performance metrics for {gymName}</p>
         </div>
         <div className="flex bg-[#1a1a2e] p-1 rounded-lg border border-[#2d2d44]">
            {['7d', '30d', '90d'].map(range => (
              <button 
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all
                  ${dateRange === range ? 'bg-[#ff4d00] text-white' : 'text-[#64748b] hover:text-[#e2e8f0]'}`}
              >
                {range.toUpperCase()}
              </button>
            ))}
         </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Peak Hours Heatmap */}
        <div className="col-span-12 lg:col-span-8 dashboard-card">
           <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-[#ff4d00]" />
              <h3 className="font-bold uppercase tracking-widest text-sm">Peak Hours Analysis (Weekly Avg)</h3>
           </div>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={peakHoursData}>
                    <defs>
                       <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff4d00" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ff4d00" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: '8px' }}
                      itemStyle={{ color: '#ff4d00' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#ff4d00" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Revenue by Plan */}
        <div className="col-span-12 lg:col-span-4 dashboard-card">
           <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-5 h-5 text-[#22c55e]" />
              <h3 className="font-bold uppercase tracking-widest text-sm">Revenue Mix</h3>
           </div>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={data.revenue_by_plan}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="total"
                      nameKey="plan_type"
                    >
                       {data.revenue_by_plan.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Churn Risk */}
        <div className="col-span-12 lg:col-span-6 dashboard-card h-[400px] flex flex-col">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <UserMinus className="w-5 h-5 text-[#ef4444]" />
                 <h3 className="font-bold uppercase tracking-widest text-sm">Churn Risk (45+ Days Inactive)</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-[#ef4444] bg-red-400/10 px-2 py-1 rounded">
                 {data.churn_risk.length} high priority leads
              </span>
           </div>
           <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {data.churn_risk.map((member, i) => {
                 const days = Math.floor((new Date() - new Date(member.last_checkin_at)) / (1000 * 60 * 60 * 24));
                 return (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-[#0d0d1a]/50 rounded-lg border border-[#2d2d44]/30">
                       <div>
                          <div className="text-sm font-bold">{member.name}</div>
                          <div className="text-[10px] text-[#64748b]">Last seen: {new Date(member.last_checkin_at).toLocaleDateString()}</div>
                       </div>
                       <div className={`px-2 py-1 rounded text-[10px] font-bold ${days >= 60 ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                          {days >= 60 ? 'CRITICAL' : 'HIGH RISK'} ({days} DAYS)
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>

        {/* New vs Renewal */}
        <div className="col-span-12 lg:col-span-6 dashboard-card">
           <div className="flex items-center gap-3 mb-6">
              <Users className="w-5 h-5 text-[#3b82f6]" />
              <h3 className="font-bold uppercase tracking-widest text-sm">New vs Renewal Ratio</h3>
           </div>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={data.new_vs_renewal}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="member_type"
                    >
                       {data.new_vs_renewal.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.member_type === 'new' ? '#ff4d00' : '#3b82f6'} />
                       ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                 </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
