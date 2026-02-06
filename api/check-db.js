const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        console.log('🔍 Buscando app_url...');
        const [rows] = await pool.query("SELECT * FROM system_settings WHERE setting_key = 'app_url'");
        console.log('Resultado:', rows);

        if (rows.length > 0) {
            let val = rows[0].setting_value;
            if (val.includes('%')) {
                const newVal = val.replace(/%/g, '');
                console.log(`🧹 Limpando app_url: ${val} -> ${newVal}`);
                await pool.query("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'app_url'", [newVal]);
                console.log('✅ app_url atualizado com sucesso.');
            } else {
                console.log('✨ app_url parece correto.');
            }
        } else {
            console.log('⚠️ app_url não encontrado no banco.');
        }
    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await pool.end();
    }
}

run();
