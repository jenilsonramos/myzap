const mysql = require('mysql2/promise');

async function addActivationCodeColumn() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'ublochat_user',
        password: 'uBoX4+5pacw2WJBn',
        database: 'ublochat_db'
    });

    try {
        console.log('🔧 Adicionando coluna activation_code na tabela users...');

        // Verificar se coluna já existe
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'ublochat_db' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'activation_code'
        `);

        if (columns.length > 0) {
            console.log('✅ Coluna activation_code já existe!');
        } else {
            await pool.query('ALTER TABLE users ADD COLUMN activation_code VARCHAR(10) NULL');
            console.log('✅ Coluna activation_code adicionada com sucesso!');
        }

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
}

addActivationCodeColumn();
