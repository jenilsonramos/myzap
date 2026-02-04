const { exec } = require('child_process');

console.log('🚀 Testando acesso PUBLICO ao Webhook...');
console.log('URL: https://ublochat.com.br/api/webhook/evolution');

const curlCommand = `curl -v -X POST "https://ublochat.com.br/api/webhook/evolution" -H "Content-Type: application/json" -d "{\\"type\\":\\"TEST_CURL\\",\\"instance\\":\\"test\\",\\"data\\":{}}" --insecure`;

exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Erro ao executar curl: ${error.message}`);
        return;
    }

    console.log(`\n--- SAÍDA DO CURL ---`);
    console.log(stderr); // Curl verbose output goes to stderr
    console.log(stdout);

    console.log(`\n---------------------------------`);
    if (stdout.includes('OK') || stdout.includes('200')) {
        console.log('✅ A URL pública está respondendo corretamente!');
        console.log('Isso significa que o Nginx/SLL está configurado certo.');
        console.log('Verifique agora se o arquivo webhook_debug.log registrou este teste.');
    } else {
        console.log('⚠️ Falha no teste público. O Nginx pode não estar encaminhando para o Node na porta 5000.');
        console.log('Verifique se o domínio aponta para este IP e se o Nginx está rodando.');
    }
});
