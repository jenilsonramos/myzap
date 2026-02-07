const mysql = require('mysql2/promise');
const EvolutionService = require('./EvolutionService');
require('dotenv').config({ path: '../.env' });

async function testProxy() {
    const msgId = 'AC477256273237AB8C2B30290FA8D6D6'; // From user log
    const instance = '01';

    console.log('--- PROXY DEBUG START ---');
    console.log(`MsgId: ${msgId}, Instance: ${instance}`);

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const [rows] = await pool.query(
            "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('evolution_url', 'evolution_apikey')"
        );
        const settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);
        console.log('Evolution Settings:', settings);

        if (!settings.evolution_url || !settings.evolution_apikey) {
            console.error('Evolution not configured!');
            return;
        }

        const evo = new EvolutionService(settings.evolution_url, settings.evolution_apikey);

        console.log('Querying DB for message context...');
        const [msgRows] = await pool.query(
            "SELECT c.remote_jid, m.key_from_me FROM messages m JOIN contacts c ON m.contact_id = c.id WHERE m.uid = ?",
            [msgId]
        );

        if (msgRows.length > 0) {
            const { remote_jid: remoteJid, key_from_me: fromMe } = msgRows[0];
            console.log(`Context found: RemoteJID=${remoteJid}, fromMe=${fromMe}`);

            console.log('Calling Evolution getBase64...');
            try {
                const data = await evo.getMediaBase64(instance, {
                    id: msgId,
                    fromMe: fromMe === 1,
                    remoteJid: remoteJid
                });
                console.log('Evolution response received.');
                if (data && data.base64) {
                    console.log(`SUCCESS: Base64 length ${data.base64.length}`);
                    console.log(`Mimetype: ${data.mimetype}`);
                } else {
                    console.error('FAILURE: No base64 in response', data);
                }
            } catch (e) {
                console.error('Evolution API error:', e.message);
            }
        } else {
            console.error('Message not found in database!');
            // Try searching without join just in case
            const [rawMsg] = await pool.query("SELECT * FROM messages WHERE uid = ?", [msgId]);
            console.log('Raw message search result:', rawMsg);
        }
    } catch (err) {
        console.error('Database/Critical error:', err.message);
    } finally {
        await pool.end();
    }
}

testProxy();
