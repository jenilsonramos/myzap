require('dotenv').config(); // Load .env from root
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

async function fixSchema() {
    let pool;
    try {
        console.log('🔧 Conectando ao Banco para corrigir Schema...');
        pool = mysql.createPool(dbConfig);

        // 1. Verificar tipo atual (opcional, mas bom pra log)
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'type'
        `, [dbConfig.database]);

        console.log('🧐 Tipo atual da coluna "type":', columns[0]?.DATA_TYPE);

        // 2. Corrigir para VARCHAR
        console.log('🚀 Alterando coluna "type" para VARCHAR(50)...');
        await pool.query("ALTER TABLE messages MODIFY COLUMN type VARCHAR(50)");
        console.log('✅ Sucesso! Coluna alterada.');

        // 3. Verificar novamente
        const [columnsNew] = await pool.query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'type'
        `, [dbConfig.database]);
        console.log('🧐 Novo tipo da coluna "type":', columnsNew[0]?.DATA_TYPE);

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        if (pool) await pool.end();
    }
}

fixSchema();
