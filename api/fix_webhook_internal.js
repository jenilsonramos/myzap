const mysql = require('mysql2/promise');
const EvolutionService = require('./EvolutionService');
require('dotenv').config();

// ENDEREÇO MÁGICO DO DOCKER
// 'host.docker.internal' resolve para o IP da máquina host DENTRO do container.
// Isso evita sair pra internet e voltar (o que falhou antes).
const INTERNAL_HOST = 'host.docker.internal';
const WEBHOOK_URL = `http://${INTERNAL_HOST}:5000/api/webhook/evolution`;

async function fix() {
    console.log('🚀 Iniciando Bypass DOCKER INTERNAL...');
    console.log(`🔗 Nova URL: ${WEBHOOK_URL}`);
    console.log('(Isso diz pra Evolution: "Mande pro host que está me rodando, na porta 5000")');

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
                const res = await evo.setWebhook(name, WEBHOOK_URL, true);
                console.log(`✅ Sucesso! Resposta da Evolution:`, JSON.stringify(res));
            } catch (err) {
                console.error(`❌ Falha ao ajustar ${name}:`, err.message);
            }
        }

        console.log('\n🏁 Bypass Docker Internal Concluído. Tente enviar uma mensagem agora!');

    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        await pool.end();
    }
}

fix();
