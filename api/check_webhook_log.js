const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'webhook_debug.log');

if (!fs.existsSync(logFile)) {
    console.log('❌ Arquivo de log não encontrado. Nenhuma mensagem recebida ainda?');
    process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n').filter(e => e.trim());
const lastEntries = lines.slice(-20); // Mostrar mais linhas

console.log(`--- ÚLTIMAS ${lastEntries.length} LINHAS DO LOG ---\n`);

lastEntries.forEach(line => {
    try {
        if (line.trim().startsWith('{')) {
            const json = JSON.parse(line.trim());
            console.log(`📌 [PAYLOAD] ${json.time}`);
            console.log(`   Type: ${json.body.type || json.body.event}`);
            console.log(`   Instance: ${json.body.instance}\n`);
        } else if (line.trim().startsWith('[')) {
            console.log(`${line}`); // Logs com timestamp [DATA] ...
        } else {
            console.log(`📝 ${line}`);
        }
    } catch (e) {
        console.log(`? ${line.substring(0, 150)}`);
    }
});
