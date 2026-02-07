
try {
    console.log('🚀 Tentando iniciar o servidor manualmente...');
    process.env.PORT = 3001; // Force port
    require('./server.js');
} catch (err) {
    console.error('❌ ERRO FATAL AO INICIAR SERVIDOR:', err);
    console.error(err.stack);
}
