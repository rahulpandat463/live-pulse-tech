// seed.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://wtf:wtf_secret@localhost:5432/wtf_livepulse',
});

const GYM_NAMES = [
  'WTF South Ex', 'WTF HSR Layout', 'WTF Indiranagar', 'WTF Koregaon Park', 
  'WTF Powai', 'WTF Cyber City', 'WTF Salt Lake', 'WTF Gomti Nagar', 
  'WTF Jubilee Hills', 'WTF Whitefield'
];

const CITIES = ['Delhi', 'Bangalore', 'Bangalore', 'Pune', 'Mumbai', 'Gurgaon', 'Kolkata', 'Lucknow', 'Hyderabad', 'Bangalore'];

const PLAN_TYPES = ['monthly', 'quarterly', 'annual'];

const seed = async () => {
  console.log('Checking for existing data...');
  const client = await pool.connect();
  try {
    const { rows: existingGyms } = await client.query('SELECT COUNT(*) FROM gyms');
    if (parseInt(existingGyms[0].count) > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    console.log('Seeding database...');
    await client.query('BEGIN');

    // Clear existing data
    await client.query('TRUNCATE table checkins, payments, anomalies, members, gyms CASCADE');

    // 1. Seed Gyms
    const gyms = [];
    for (let i = 0; i < 10; i++) {
      const { rows } = await client.query(
        'INSERT INTO gyms (name, city, address, capacity) VALUES ($1, $2, $3, $4) RETURNING *',
        [GYM_NAMES[i], CITIES[i], `${i + 1} Main St, ${CITIES[i]}`, 80 + Math.floor(Math.random() * 221)]
      );
      gyms.push(rows[0]);
    }

    // 2. Seed Members
    const members = [];
    for (let i = 0; i < 5000; i++) {
      const gym = gyms[Math.floor(Math.random() * gyms.length)];
      const planType = PLAN_TYPES[Math.floor(Math.random() * PLAN_TYPES.length)];
      const joinedAt = new Date();
      joinedAt.setDate(joinedAt.getDate() - Math.floor(Math.random() * 90));
      
      const planExpiresAt = new Date(joinedAt);
      if (planType === 'monthly') planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
      else if (planType === 'quarterly') planExpiresAt.setMonth(planExpiresAt.getMonth() + 3);
      else planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);

      const { rows } = await client.query(
        'INSERT INTO members (gym_id, name, email, plan_type, joined_at, plan_expires_at, last_checkin_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [gym.id, `Member ${i + 1}`, `member${i + 1}@example.com`, planType, joinedAt, planExpiresAt, joinedAt]
      );
      members.push(rows[0]);
    }

    // 3. Seed Checkins & Payments (Historical - last 90 days)
    console.log('Generating historical events (this may take a moment)...');
    
    // Payments: Each member pays at least once
    for (const member of members) {
        const amount = member.plan_type === 'monthly' ? 2999 : member.plan_type === 'quarterly' ? 7999 : 24999;
        await client.query(
            'INSERT INTO payments (member_id, gym_id, amount, plan_type, paid_at) VALUES ($1, $2, $3, $4, $5)',
            [member.id, member.gym_id, amount, member.plan_type, member.joined_at]
        );
    }

    // Checkins: Generate ~200,000+ checkins
    // We'll generate daily checkins for members with a certain probability
    // Logic: Peak hours 7am-10am and 5pm-8pm
    for (let d = 0; d < 90; d++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        
        // Pick random subset of active members for this day
        const activeToday = members.filter(m => m.joined_at <= date && Math.random() < 0.6);
        
        for (const member of activeToday) {
            // Peak hour probability
            let hour;
            const rand = Math.random();
            if (rand < 0.4) hour = 7 + Math.floor(Math.random() * 3); // 7-10am
            else if (rand < 0.8) hour = 17 + Math.floor(Math.random() * 3); // 5-8pm
            else hour = 6 + Math.floor(Math.random() * 16); // Random other time

            const checkinTime = new Date(date);
            checkinTime.setHours(hour, Math.floor(Math.random() * 60));
            
            const checkoutTime = new Date(checkinTime);
            checkoutTime.setHours(checkoutTime.getHours() + 1, checkoutTime.getMinutes() + Math.floor(Math.random() * 60));

            await client.query(
                'INSERT INTO checkins (member_id, gym_id, checked_in, checked_out) VALUES ($1, $2, $3, $4)',
                [member.id, member.gym_id, checkinTime, checkoutTime]
            );
        }
        if (d % 10 === 0) console.log(`Seeded day ${d}/90...`);
    }

    // Refresh Materialized View
    await client.query('REFRESH MATERIALIZED VIEW gym_hourly_stats');

    await client.query('COMMIT');
    console.log('Seed successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('Seed failed:', err);
  } finally {
    client.release();
    pool.end();
  }
};

seed();
