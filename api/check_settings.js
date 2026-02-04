require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db'
    });

    try {
        const [rows] = await pool.query("SELECT * FROM system_settings WHERE setting_key = 'app_url'");
        console.log('🔗 [DEBUG] app_url settings:', rows);
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
}
check();
