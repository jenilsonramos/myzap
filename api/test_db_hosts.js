require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function check() {
    // Tenta primeiro o host do env, depois localhost
    const hosts = [process.env.DB_HOST, '127.0.0.1', 'localhost'];

    for (const h of hosts) {
        if (!h) continue;
        console.log(`📡 Tentando conectar ao host: ${h}...`);
        try {
            const pool = await mysql.createConnection({
                host: h,
                user: process.env.DB_USER || 'ublochat_user',
                password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
                database: process.env.DB_NAME || 'ublochat_db'
            });
            console.log(`✅ SUCESSO na conexão com ${h}!`);
            await pool.end();
            return;
        } catch (err) {
            console.log(`❌ FALHA em ${h}: ${err.message}`);
        }
    }
}
check();
