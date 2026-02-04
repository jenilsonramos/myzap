const mysql = require('mysql2/promise');
const EvolutionService = require('./EvolutionService');
require('dotenv').config();

// MODO REMOTO / PRODUÇÃO
// Como a Evolution está em OUTRO servidor, ela precisa acessar o MyZap pela internet pública.
// Usamos o domínio oficial com HTTPS.
const PUBLIC_DOMAIN = 'https://ublochat.com.br';
const WEBHOOK_URL = `${PUBLIC_DOMAIN}/api/webhook/evolution`;

async function fix() {
    console.log('🚀 Iniciando Configuração de Domínio Remoto...');
    console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);
    console.log('ℹ️ Isso fará a Evolution enviar mensagens pela internet para este servidor.');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await pool.query(
            "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('evolution_url', 'evolution_apikey')"
        );
        const settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);

        if (!settings.evolution_url) {
            console.error('❌ Nenhuma URL da Evolution configurada no banco.');
            return;
        }

        const evo = new EvolutionService(settings.evolution_url, settings.evolution_apikey);

        console.log('📡 Buscando instâncias no banco...');
        const [instances] = await pool.query("SELECT business_name FROM whatsapp_accounts");

        for (const inst of instances) {
            const name = inst.business_name;
            console.log(`\n🔧 Ajustando Webhook para: ${name}`);
            try {
                // Configuração padrão com HTTPS
                const res = await evo.setWebhook(name, WEBHOOK_URL, true);
                console.log(`✅ Sucesso! Resposta da Evolution:`, JSON.stringify(res));
            } catch (err) {
                if (err.message.includes('not exist')) {
                    console.log(`⚠️ Instância '${name}' inexistente na Evolution (Ignorando).`);
                } else {
                    console.error(`❌ Falha ao ajustar ${name}:`, err.message);
                }
            }
        }

        console.log('\n🏁 Configuração Concluída.');
        console.log('IMPORTANTE: Se a mensagem não chegar, verifique se o FIREWALL deste servidor permite entrada da Evolution.');

    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        await pool.end();
    }
}

fix();
