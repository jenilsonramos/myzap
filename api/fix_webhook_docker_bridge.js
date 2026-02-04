const mysql = require('mysql2/promise');
const EvolutionService = require('./EvolutionService');
require('dotenv').config();

// IP PADRÃO DO GATEWAY DOCKER (LINUX)
// Em 99% dos servidores Linux, o host é acessível de dentro do container via 172.17.0.1
const DOCKER_GATEWAY = '172.17.0.1';
const WEBHOOK_URL = `http://${DOCKER_GATEWAY}:5000/api/webhook/evolution`;

async function fix() {
    console.log('🚀 Iniciando Bypass DOCKER GATEWAY (172.17.0.1)...');
    console.log(`🔗 Nova URL: ${WEBHOOK_URL}`);

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
                // Tenta ajustar URL
                const res = await evo.setWebhook(name, WEBHOOK_URL, true);
                console.log(`✅ Sucesso! Resposta da Evolution:`, JSON.stringify(res));
            } catch (err) {
                if (err.message.includes('not exist')) {
                    console.error(`⚠️ A instância '${name}' existe no banco local mas não na Evolution.`);
                    console.log(`🛠️ Removendo '${name}' do banco local para limpar...`);
                    await pool.query("DELETE FROM whatsapp_accounts WHERE business_name = ?", [name]);
                    console.log(`🗑️ Removido.`);
                } else {
                    console.error(`❌ Falha ao ajustar ${name}:`, err.message);
                }
            }
        }

        console.log('\n🏁 Bypass Docker Gateway Concluído. Tente enviar uma mensagem agora!');

    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        await pool.end();
    }
}

fix();
