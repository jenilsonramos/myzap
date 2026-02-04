const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'webhook_debug.log');

if (!fs.existsSync(logFile)) {
    console.log('❌ Arquivo de log não encontrado. Nenhuma mensagem recebida ainda?');
    process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n').filter(e => e.trim());
const lastEntries = lines.slice(-200); // Ler ultimas 200 linhas

console.log(`--- ANALISANDO ÚLTIMAS 200 LINHAS (Filtrando ruído...) ---\n`);

lastEntries.forEach(line => {
    try {
        const trimmed = line.trim();
        // Ignorar linhas de presença/chats/contatos para limpar a visão
        if (trimmed.includes('presence.update') || trimmed.includes('contacts.update') || trimmed.includes('chats.update')) {
            return;
        }

        if (trimmed.startsWith('{')) {
            const json = JSON.parse(trimmed);
            console.log(`📌 [PAYLOAD] ${json.time}`);
            console.log(`   Type: ${json.body.type || json.body.event}`);
            console.log(`   Instance: ${json.body.instance}`);
            // Se for message, mostrar chaves
            if (json.body.data) {
                console.log(`   Data: ${JSON.stringify(json.body.data).substring(0, 150)}...`);
            }
            console.log('');
        } else if (trimmed.startsWith('[')) {
            // Logs de debug com data (ex: [2024...] 📨 Processando...)
            console.log(`📝 ${trimmed}`);
        } else {
            // Outros logs
            console.log(`❓ ${trimmed}`);
        }
    } catch (e) {
        // Ignorar erro de parse para focar no que importa
    }
});
