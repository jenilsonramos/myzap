const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db',
    multipleStatements: true // Permite executar várias queries de uma vez
};

async function importSql() {
    try {
        const sqlPath = path.join(__dirname, '../backup_data.txt');
        console.log(`Lendo arquivo SQL: ${sqlPath}`);

        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('Conectando ao banco de dados...');
        const conn = await mysql.createConnection(dbConfig);
        console.log('Conectado!');

        // Tenta executar tudo de uma vez (pode falhar se for muito grande, mas 250kb deve aguentar)
        // Se falhar, teremos que dividir
        console.log('Executando importação...');
        await conn.query(sqlContent);

        console.log('✅ Importação concluída com sucesso!');
        await conn.end();
    } catch (err) {
        console.error('❌ Erro na importação:', err.message);
        console.error(err);
    }
}

importSql();
