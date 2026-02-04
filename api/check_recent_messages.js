const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('--- RECENT MESSAGES ---');
        const [rows] = await pool.query("SELECT * FROM messages ORDER BY id DESC LIMIT 5");
        if (rows.length === 0) {
            console.log('No messages found in database.');
        } else {
            rows.forEach(r => {
                console.log(`[${r.created_at || r.timestamp}] FromMe: ${r.key_from_me}, Content: ${r.content?.slice(0, 50)}...`);
            });
        }

        console.log('\n--- SYSTEM URL ---');
        const [settings] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
        console.log('App URL in DB:', settings[0]?.setting_value);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
