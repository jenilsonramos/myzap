const http = require('http');

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function simulate() {
    try {
        console.log('🔑 Autenticando...');
        const loginResp = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { email: 'admin@site.com', password: 'password' }); // Tentando senha padrão, se falhar checar setupTables

        let token = loginResp.body.token;
        if (!token) {
            console.log('⚠️ Login padrão falhou, tentando criar usuário admin via setupTables (improvável funcionar via script externo).');
            console.log('Retorno:', loginResp.body);
            return;
        }

        console.log('🔍 Buscando instâncias...');
        const instancesResp = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/instances',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const instances = instancesResp.body;
        console.log(`Instâncias encontradas: ${instances.length}`);

        if (instances.length === 0) {
            console.error('❌ Nenhuma instância encontrada para testar.');
            return;
        }

        const targetInstance = instances[0].name || instances[0].instance.instanceName;
        console.log(`🎯 Usando instância: ${targetInstance}`);

        const payload = JSON.stringify({
            "event": "messages.upsert",
            "instance": targetInstance,
            "data": {
                "key": {
                    "remoteJid": "5511999999999@s.whatsapp.net",
                    "fromMe": false,
                    "id": "SIMULATED_" + Date.now()
                },
                "pushName": "Teste Local Simulator",
                "message": {
                    "conversation": "Teste de Recebimento " + new Date().toLocaleTimeString()
                },
                "messageTimestamp": Math.floor(Date.now() / 1000),
                "owner": targetInstance
            },
            "type": "messages.upsert"
        });

        console.log('🚀 Enviando webhook...');
        const webhookResp = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/webhook/evolution',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, JSON.parse(payload));

        console.log(`📥 Status Webhook: ${webhookResp.status}`);
        console.log(`📥 Resposta: ${JSON.stringify(webhookResp.body)}`);

    } catch (err) {
        console.error('❌ Erro:', err);
    }
}

simulate();
