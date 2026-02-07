
const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🔍 INICIANDO DIAGNÓSTICO DE BANCO DE DADOS 🔍');
console.log('==============================================');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ublochat_db'
};

console.log('📂 Configurações Lidas do .env:');
console.log(`- HOST: ${dbConfig.host}`);
console.log(`- USER: ${dbConfig.user}`);
console.log(`- PASS: ${dbConfig.password ? '******' + dbConfig.password.slice(-3) : '(NÃO DEFINIDO!)'}`);
console.log(`- BASE: ${dbConfig.database}`);
console.log('----------------------------------------------');

async function testConnection() {
    try {
        console.log('📡 Tentando conectar...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ CONEXÃO BEM SUCEDIDA!');

        console.log('📊 Verificando tabela system_settings...');
        const [rows] = await connection.execute("SHOW TABLES LIKE 'system_settings'");
        if (rows.length > 0) {
            console.log('✅ Tabela system_settings ENCONTRADA.');

            const [settings] = await connection.execute("SELECT setting_key, setting_value FROM system_settings LIMIT 5");
            console.log('📝 Primeiros registros:', settings);
        } else {
            console.error('❌ Tabela system_settings NÃO ENCONTRADA!');
            console.log('💡 DICA: Rode o script api/create_settings_table.js');
        }

        await connection.end();
        console.log('==============================================');
        console.log('🎉 DIAGNÓSTICO CONCLUÍDO COM SUCESSO. O BANCO ESTÁ ACESSÍVEL.');
    } catch (err) {
        console.error('❌ FALHA NA CONEXÃO:');
        console.error(`Status: ${err.code}`);
        console.error(`Mensagem: ${err.message}`);

        if (err.code === 'ECONNREFUSED') {
            console.log('💡 DICA: O MySQL pode não estar rodando ou a porta está errada.');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('💡 DICA: Usuário ou senha incorretos no arquivo .env.');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.log(`💡 DICA: O banco de dados '${dbConfig.database}' não foi criado.`);
        }
        process.exit(1);
    }
}

testConnection();
