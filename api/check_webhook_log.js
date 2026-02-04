const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'webhook_debug.log');

if (!fs.existsSync(logFile)) {
    console.log('❌ Arquivo de log não encontrado. Nenhuma mensagem recebida ainda?');
    process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');
const entries = content.split(',\n').filter(e => e.trim());
const lastEntries = entries.slice(-5);

console.log(`--- ÚLTIMOS ${lastEntries.length} PAYLOADS RECEBIDOS ---\n`);
lastEntries.forEach(entry => {
    try {
        const json = JSON.parse(entry);
        console.log(`🕒 Hora: ${json.time}`);
        console.log(`Event: ${json.body.type || json.body.event}`);
        console.log(`Instance: ${json.body.instance}`);
        console.log(`Data Keys: ${Object.keys(json.body.data || {}).join(', ')}`);
        // Tentar mostrar se é fromMe
        const msg = json.body.data?.data || json.body.data;
        if (msg?.key) {
            console.log(`Key: ${JSON.stringify(msg.key)}`);
        }
        console.log('--------------------------------------------------\n');
    } catch (e) {
        console.log('Log bruto (erro ao parsear):', entry.substring(0, 100));
    }
});
