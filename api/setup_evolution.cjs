require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db',
    port: process.env.DB_PORT || 3306
};

async function run() {
    console.log('🔌 Conectando ao banco de dados...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        const url = 'https://api.ublochat.com.br';
        const key = '30955fd6349b04df911b10e607a24f1a';

        console.log(`📝 Salvando configurações da Evolution API...`);
        console.log(`   URL: ${url}`);

        const queries = [
            "INSERT INTO system_settings (setting_key, setting_value) VALUES ('evolution_url', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            "INSERT INTO system_settings (setting_key, setting_value) VALUES ('evolution_apikey', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
        ];

        await connection.execute(queries[0], [url]);
        await connection.execute(queries[1], [key]);

        console.log('✅ Configurações salvas com sucesso!');
        console.log('🚀 Agora reinicie a API: pm2 restart all');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

run();
