
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    console.log('🔄 Verificando tabela system_settings...');

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await pool.execute(createTableQuery);
        console.log('✅ Tabela system_settings verificada/criada com sucesso.');

        // Inserir valores padrão se estiver vazio
        const [rows] = await pool.execute('SELECT COUNT(*) as count FROM system_settings');
        if (rows[0].count === 0) {
            console.log('📥 Inserindo configurações padrão...');
            const defaults = [
                ['system_name', 'MyZap'],
                ['primary_color', '#166534'],
                ['logo_url', ''],
                ['favicon_url', ''],
                ['seo_title', 'MyZap - Automação WhatsApp'],
                ['seo_description', 'Plataforma completa de gestão de automação do WhatsApp.'],
                ['seo_keywords', 'whatsapp, bot, automação']
            ];

            for (const [key, value] of defaults) {
                await pool.execute('INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
            }
            console.log('✅ Configurações padrão inseridas.');
        }

    } catch (err) {
        console.error('❌ Erro na migração de system_settings:', err);
    } finally {
        await pool.end();
    }
}

migrate();
