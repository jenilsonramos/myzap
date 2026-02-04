require('dotenv').config(); // Carrega .env da raiz onde o script é executado
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

async function checkStats() {
    let pool;
    try {
        console.log('🔌 Conectando ao host:', dbConfig.host, 'User:', dbConfig.user);
        pool = mysql.createPool(dbConfig);

        // Teste de conexão simples
        const [rows] = await pool.query('SELECT 1 as val');
        console.log('✅ Conexão OK! Teste:', rows[0].val);

        // 1. Verificar mensagens gerais
        const [total] = await pool.query("SELECT COUNT(*) as count FROM messages");
        console.log('📊 TOTAL DE MENSAGENS NA TABELA:', total[0].count);

        // 2. Por usuário
        const [byUser] = await pool.query("SELECT user_id, COUNT(*) as count FROM messages GROUP BY user_id");
        console.log('📊 POR USUÁRIO:', byUser);

        // 3. Enviadas vs Recebidas
        const [sent] = await pool.query("SELECT user_id, COUNT(*) as count FROM messages WHERE key_from_me = 1 GROUP BY user_id");
        console.log('📊 ENVIADAS (key_from_me=1) POR USUÁRIO:', sent);

    } catch (err) {
        console.error('❌ ERRO:', err.message);
    } finally {
        if (pool) await pool.end();
    }
}

checkStats();
