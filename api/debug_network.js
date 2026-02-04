const os = require('os');

console.log('📡 Analisando interfaces de rede...');
const interfaces = os.networkInterfaces();

Object.keys(interfaces).forEach((ifname) => {
    console.log(`\n🔹 Interface: ${ifname}`);
    interfaces[ifname].forEach((iface) => {
        // Pular endereços não IPv4 ou internos
        if ('IPv4' !== iface.family || iface.internal !== false) {
            return;
        }
        console.log(`   IP: ${iface.address}`);
        console.log(`   Netmask: ${iface.netmask}`);
    });
});

console.log('\n----------------------------------------');
console.log('🔍 Dica: Tente usar o IP da interface "docker0" ou "eth0"');
