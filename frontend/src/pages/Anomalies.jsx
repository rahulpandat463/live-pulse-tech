// Anomalies.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, Info, XCircle, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = 'http://localhost:3001/api';

const Anomalies = () => {
    const [anomalies, setAnomalies] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAnomalies = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/anomalies`);
            setAnomalies(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching anomalies:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnomalies();
    }, []);

    const dismissAnomaly = async (id) => {
        try {
            await axios.patch(`${API_BASE_URL}/anomalies/${id}/dismiss`);
            setAnomalies(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to dismiss anomaly');
        }
    };

    if (loading) {
        return (
          <div className="flex-1 flex items-center justify-center">
             <div className="w-12 h-12 border-4 border-[#ef4444] border-t-transparent rounded-full animate-spin" />
          </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">System Health & Anomalies</h2>
                <p className="text-sm text-[#64748b]">Live security and operational monitoring engine</p>
            </div>

            <div className="dashboard-card overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-widest text-[#64748b] border-b border-[#2d2d44]">
                            <th className="px-6 py-4 font-black">Gym Name</th>
                            <th className="px-6 py-4 font-black">Anomaly Type</th>
                            <th className="px-6 py-4 font-black">Severity</th>
                            <th className="px-6 py-4 font-black">Time Detected</th>
                            <th className="px-6 py-4 font-black">Status</th>
                            <th className="px-6 py-4 font-black text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2d44]/50">
                        <AnimatePresence>
                            {anomalies.map((anomaly) => (
                                <motion.tr 
                                    key={anomaly.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="hover:bg-[#1a1a2e]/50 transition-all text-sm"
                                >
                                    <td className="px-6 py-4 font-bold">{anomaly.gym_name || 'Gym Location'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {anomaly.type === 'capacity_breach' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <Info className="w-4 h-4 text-yellow-500" />}
                                            <span className="capitalize">{anomaly.type.replace('_', ' ')}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest
                                            ${anomaly.severity === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                            {anomaly.severity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-[#64748b] font-mono">
                                        {new Date(anomaly.detected_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {anomaly.resolved ? 
                                                <span className="flex items-center gap-1 text-green-500 text-[10px] font-bold"><CheckCircle className="w-3 h-3" /> RESOLVED</span> : 
                                                <span className="flex items-center gap-1 text-red-500 text-[10px] font-bold"><Activity className="w-3 h-3 animate-pulse" /> ACTIVE</span>
                                            }
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {anomaly.severity === 'warning' && !anomaly.dismissed && (
                                            <button 
                                                onClick={() => dismissAnomaly(anomaly.id)}
                                                className="text-[10px] font-black uppercase text-[#64748b] hover:text-[#e2e8f0]"
                                            >
                                                Dismiss Warning
                                            </button>
                                        )}
                                        {anomaly.dismissed && <span className="text-[10px] text-[#64748b] italic">Dismissed</span>}
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
                {anomalies.length === 0 && (
                    <div className="p-12 text-center space-y-4">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                        <h3 className="text-xl font-bold">No anomalies detected</h3>
                        <p className="text-[#64748b] text-sm">System integrity is 100% stable.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Anomalies;
