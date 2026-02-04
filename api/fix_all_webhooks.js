const mysql = require('mysql2/promise');
const EvolutionService = require('./EvolutionService');
require('dotenv').config();

async function fix() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('🚀 Starting Webhook Sync...');

        // 1. Get App URL
        const [settings] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
        const appUrl = settings[0]?.setting_value || 'https://ublochat.com.br';
        const webhookUrl = `${appUrl}/api/webhook/evolution`;
        console.log(`🔗 Target Webhook URL: ${webhookUrl}`);

        // 2. Get Evolution Config
        const [evoRows] = await pool.query(
            "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('evolution_url', 'evolution_apikey')"
        );
        const evoSettings = {};
        evoRows.forEach(r => evoSettings[r.setting_key] = r.setting_value);

        if (!evoSettings.evolution_url || !evoSettings.evolution_apikey) {
            console.error('❌ Evolution URL or API Key missing in system_settings.');
            return;
        }

        const evo = new EvolutionService(evoSettings.evolution_url, evoSettings.evolution_apikey);

        // 3. Get all instances from local DB
        const [instances] = await pool.query("SELECT business_name FROM whatsapp_accounts");
        console.log(`Found ${instances.length} instances to sync.`);

        for (const inst of instances) {
            const name = inst.business_name;
            console.log(`📡 Syncing ${name}...`);
            try {
                const result = await evo.setWebhook(name, webhookUrl, true);
                console.log(`✅ Result for ${name}:`, result.message || 'Success');
            } catch (err) {
                console.error(`❌ Failed to sync ${name}:`, err.message);
            }
        }

        console.log('🏁 Webhook Sync Finished.');

    } catch (err) {
        console.error('Fatal Error:', err.message);
    } finally {
        await pool.end();
    }
}

fix();
