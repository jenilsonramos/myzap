const mysql = require('mysql2/promise');
const EvolutionService = require('./EvolutionService');
require('dotenv').config();

// IP PÚBLICO DO VPS + Porta 80 (Padrão HTTP via Nginx)
// A ideia é: O container sai pra internet, bate no IP do VPS na porta 80, o Nginx pega e repassa pro Node (5000)
// Isso evita DNS (ublochat.com.br) mas usa a porta aberta (80) em vez da fechada (5000)
const VPS_IP = '194.163.189.247';
const WEBHOOK_URL = `http://${VPS_IP}/api/webhook/evolution`;

async function fix() {
    console.log('🚀 Iniciando Bypass de DNS (Via Nginx/Porta 80)...');
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
                // Forçar HTTP e IP direto na porta 80
                const res = await evo.setWebhook(name, WEBHOOK_URL, true);
                console.log(`✅ Sucesso! Resposta da Evolution:`, JSON.stringify(res));
            } catch (err) {
                console.error(`❌ Falha ao ajustar ${name}:`, err.message);
            }
        }

        console.log('\n🏁 Bypass Port 80 Concluído. Tente enviar uma mensagem agora!');

    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        await pool.end();
    }
}

fix();
