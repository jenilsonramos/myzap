require('dotenv').config();
const EvolutionService = require('./api/EvolutionService');
const mysql = require('mysql2/promise');

async function test() {
    console.log('🏁 Iniciando teste de Webhook...');

    // 1. Setup DB Connection for Settings
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db'
    });

    try {
        const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'evolution_apikey'");
        const [urlRows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'evolution_url'");

        const apiKey = rows[0]?.setting_value;
        const baseUrl = urlRows[0]?.setting_value;

        if (!apiKey || !baseUrl) {
            console.error('❌ Configurações da Evolution não encontradas no DB.');
            process.exit(1);
        }

        console.log(`✅ Configuração encontrada: ${baseUrl}`);
        const evo = new EvolutionService(baseUrl, apiKey);

        // 2. Tenta configurar webhook para uma instância de teste
        // Vamos pegar a primeira instância 'connected' que acharmos ou 'love' conforme erro do user
        const instances = await evo.fetchInstances();
        console.log('📋 Instâncias encontradas:', instances.length);

        // Pega 'love' ou a primeira
        let target = instances.find(i => i.name === 'love' || i.instance?.instanceName === 'love');
        if (!target && instances.length > 0) target = instances[0];

        if (!target) {
            console.error('❌ Nenhuma instância disponível para teste.');
            process.exit(1);
        }

        const name = target.name || target.instance?.instanceName;
        console.log(`🎯 Testando na instância: ${name}`);

        const webhookUrl = 'https://app.ublochat.com.br/api/webhook/evolution';

        console.log('📡 Enviando requisição setWebhook...');
        try {
            const result = await evo.setWebhook(name, webhookUrl, true);
            console.log('✅ Sucesso:', JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('❌ Erro no setWebhook:', err.message);
            // console.error(err);
        }

    } catch (err) {
        console.error('❌ Erro global:', err);
    } finally {
        await pool.end();
    }
}

test();
