require('dotenv').config({ path: '../.env' });
const fetch = require('node-fetch');

async function check() {
    const url = process.env.EVOLUTION_URL || 'https://evo.ublochat.com.br';
    const apikey = process.env.EVOLUTION_APIKEY;

    try {
        console.log(`🔍 Consultando Evolution em ${url}...`);

        // Vamos listar instâncias primeiro
        const resList = await fetch(`${url}/instance/fetchInstances`, {
            headers: { 'apikey': apikey }
        });
        const instances = await resList.json();

        for (const inst of instances) {
            const name = inst.instanceName;
            console.log(`\n--- Instância: ${name} ---`);

            const resWh = await fetch(`${url}/webhook/find/${name}`, {
                headers: { 'apikey': apikey }
            });
            const wh = await resWh.json();
            console.log('🔗 Webhook:', JSON.stringify(wh, null, 2));
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}
check();
