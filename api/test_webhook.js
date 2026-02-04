require('dotenv').config({ path: '../.env' });
const EvolutionService = require('./EvolutionService');
const mysql = require('mysql2/promise');

async function test() {
    console.log('🏁 Iniciando teste de Webhook (API Context)...');

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

        // 2. Busca instâncias
        const instances = await evo.fetchInstances();
        console.log('📋 Instâncias encontradas:', instances.length);

        // Tenta achar 'love' ou usa a primeira
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
        const result = await evo.setWebhook(name, webhookUrl, true);
        console.log('✅ Resultado (Raw):', JSON.stringify(result, null, 2));

        if (result && result.webhook) {
            console.log('✅ Webhook configurado com sucesso!');
        } else {
            console.warn('⚠️ Resposta inesperada (mas pode ter dado certo se não for erro 400/500)');
        }

    } catch (err) {
        require('fs').writeFileSync('error.txt', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        console.log('FALHA_TESTE_WEBHOOK:', err.message);
        if (err.message.includes('500')) {
            console.log('DETALHE_ERRO_500');
        }
    } finally {
        await pool.end();
    }
}

test();
