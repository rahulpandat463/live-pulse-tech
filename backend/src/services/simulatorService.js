// simulatorService.js
const db = require('../db/pool');
const { broadcast } = require('../websocket/server');

let simulationInterval = null;
let simulationSpeed = 1;

const getRandomMember = async () => {
    const { rows } = await db.query('SELECT * FROM members ORDER BY RANDOM() LIMIT 1');
    return rows[0];
};

const getOpenCheckin = async (gymId) => {
    const { rows } = await db.query('SELECT * FROM checkins WHERE gym_id = $1 AND checked_out IS NULL ORDER BY RANDOM() LIMIT 1', [gymId]);
    return rows[0];
};

const simulateEvent = async () => {
    const gyms = await db.query('SELECT * FROM gyms WHERE status = \'active\'');
    const gym = gyms.rows[Math.floor(Math.random() * gyms.rows.length)];
    
    const now = new Date();
    const hour = now.getHours();
    
    // Time-based probability weight for checkins
    // Peak 6-9am (6,7,8) and 5-8pm (17,18,19)
    let checkinProb = 0.2; // Base
    if ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20)) {
        checkinProb = 0.6;
    } else if (hour >= 23 || hour <= 5) {
        checkinProb = 0.05;
    }
    
    const rand = Math.random();
    
    if (rand < checkinProb) {
        // CHECKIN
        const member = await getRandomMember();
        if (member) {
            const { rows: checkin } = await db.query(
                'INSERT INTO checkins (member_id, gym_id) VALUES ($1, $2) RETURNING *',
                [member.id, gym.id]
            );
            
            const { rows: count } = await db.query('SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL', [gym.id]);
            const occupancy = parseInt(count[0].count);
            
            broadcast({
                type: 'CHECKIN_EVENT',
                gym_id: gym.id,
                member_name: member.name,
                timestamp: new Date(),
                current_occupancy: occupancy,
                capacity_pct: (occupancy / gym.capacity) * 100
            });
        }
    } else if (rand < 0.9) {
        // CHECKOUT
        const openCheckin = await getOpenCheckin(gym.id);
        if (openCheckin) {
            await db.query(
                'UPDATE checkins SET checked_out = NOW() WHERE id = $1',
                [openCheckin.id]
            );
            
            const { rows: member } = await db.query('SELECT name FROM members WHERE id = $1', [openCheckin.member_id]);
            const { rows: count } = await db.query('SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL', [gym.id]);
            const occupancy = parseInt(count[0].count);
            
            broadcast({
                type: 'CHECKOUT_EVENT',
                gym_id: gym.id,
                member_name: member[0]?.name || 'Unknown',
                timestamp: new Date(),
                current_occupancy: occupancy,
                capacity_pct: (occupancy / gym.capacity) * 100
            });
        }
    } else {
        // PAYMENT
        const member = await getRandomMember();
        if (member) {
            const amount = member.plan_type === 'monthly' ? 2999 : member.plan_type === 'quarterly' ? 7999 : 24999;
            await db.query(
                'INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type) VALUES ($1, $2, $3, $4, $5)',
                [member.id, gym.id, amount, member.plan_type, 'renewal']
            );
            
            const { rows: total } = await db.query('SELECT SUM(amount) FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE', [gym.id]);
            
            broadcast({
                type: 'PAYMENT_EVENT',
                gym_id: gym.id,
                amount,
                plan_type: member.plan_type,
                member_name: member.name,
                today_total: parseFloat(total[0].sum || 0)
            });
        }
    }
};

const startSimulation = (speed = 1) => {
    simulationSpeed = speed;
    if (simulationInterval) clearInterval(simulationInterval);
    
    const intervalMs = 2000 / simulationSpeed;
    simulationInterval = setInterval(async () => {
        try {
            await simulateEvent();
        } catch (err) {
            console.error('Simulation error:', err);
        }
    }, intervalMs);
    
    return { status: 'running', speed };
};

const stopSimulation = () => {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    return { status: 'paused' };
};

module.exports = {
    startSimulation,
    stopSimulation
};
