const http = require('http');

async function simulate() {
    const payload = JSON.stringify({
        "event": "messages.upsert",
        "instance": "cxxx",
        "data": {
            "key": {
                "remoteJid": "5511999999999@s.whatsapp.net",
                "fromMe": false,
                "id": "SIMULATED_" + Date.now()
            },
            "pushName": "Teste Local",
            "message": {
                "conversation": "Esta é uma mensagem de teste do simulador."
            },
            "messageTimestamp": Math.floor(Date.now() / 1000),
            "owner": "cxxx"
        },
        "type": "messages.upsert"
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

    console.log('🚀 Enviando simulação para http://localhost:5000/api/webhook/evolution ...');

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`📥 Status: ${res.statusCode}`);
            console.log(`📥 Resposta: ${data}`);
            if (res.statusCode === 200) {
                console.log('\n✅ Simulação enviada com sucesso!');
                console.log('Agora rode: node api/check_recent_messages.js para verificar se salvou no banco.');
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
