const http = require('http');

async function simulate() {
    const payload = JSON.stringify({
        "event": "SEND_MESSAGE",
        "instance": "cxxx",
        "data": {
            "key": {
                "remoteJid": "5511999999999@s.whatsapp.net",
                "fromMe": true,
                "id": "SENT_SIMULATED_" + Date.now()
            },
            "pushName": "Eu",
            "message": {
                "conversation": "Mensagem enviada pelo celular (simulada)."
            },
            "messageTimestamp": Math.floor(Date.now() / 1000),
            "owner": "cxxx"
        },
        "type": "SEND_MESSAGE"
    });

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/webhook/evolution',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    console.log('🚀 Enviando simulação de ENVIO (SEND_MESSAGE) ...');

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`📥 Status: ${res.statusCode}`);
            console.log(`📥 Resposta: ${data}`);
            if (res.statusCode === 200) {
                console.log('\n✅ Simulação de ENVIO aceita!');
                console.log('Rode node api/check_recent_messages.js para ver se apareceu com FromMe: 1');
            } else {
                console.error('\n❌ Falha na simulação.');
            }
        });
    });

    req.on('error', (err) => {
        console.error('❌ Erro na conexão:', err.message);
    });

    req.write(payload);
    req.end();
}

simulate();
