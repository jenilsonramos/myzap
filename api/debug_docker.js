const { exec } = require('child_process');

console.log('🐳 Inspecionando Docker...');

exec('docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}"', (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Erro ao listar containers: ${error.message}`);
        console.log('Se o comando "docker" não for encontrado, a Evolution pode estar rodando via PM2 ou nativamente?');
        return;
    }
    console.log('\n--- CONTAINERS RODANDO ---');
    console.log(stdout);

    console.log('\n--- REDES DOCKER ---');
    exec('docker network ls', (err, stdoutNet) => {
        if (!err) console.log(stdoutNet);

        console.log('\n--- DETALHES DA REDE BRIDGE (Gateway) ---');
        exec('docker network inspect bridge', (err2, stdoutBridge) => {
            if (!err2) {
                try {
                    const json = JSON.parse(stdoutBridge);
                    const config = json[0]?.IPAM?.Config || [];
                    console.log('Gateway IP:', config[0]?.Gateway || 'Não encontrado');
                } catch (e) {
                    console.log(stdoutBridge.substring(0, 200));
                }
            }
        });
    });
});
