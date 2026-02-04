require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function setup() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db'
    });

    try {
        console.log('🏗️ Criando tabelas de Chat...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                remote_jid VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                profile_pic TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_contact (user_id, remote_jid)
            )
        `);
        console.log('✅ Tabela contacts verificada.');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                contact_id INT,
                instance_name VARCHAR(100),
                uid VARCHAR(255) UNIQUE, 
                key_from_me BOOLEAN,
                content TEXT,
                type VARCHAR(50), 
                timestamp BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela messages verificada.');

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await pool.end();
    }
}
setup();
