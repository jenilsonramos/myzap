const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function dumpPlans() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db',
        port: parseInt(process.env.DB_PORT) || 3306
    });

    try {
        const [rows] = await pool.execute('SELECT * FROM plans');
        console.log('--- PLANS DATA ---');
        console.log(JSON.stringify(rows, null, 2));
        console.log('--- END PLANS DATA ---');
    } catch (err) {
        console.error('Error dumping plans:', err);
    } finally {
        await pool.end();
    }
}

dumpPlans();
