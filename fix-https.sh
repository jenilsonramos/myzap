#!/bin/bash

# Script de Correção v15 - REPARO DE EMERGÊNCIA E LOGS
# Resolve falha de inicialização da API e limpeza de módulos

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"
DB_NAME="myzap"

echo ">>> Iniciando REPARO v15 (Limpeza Total e Logs) <<<"

# 1. Limpeza de Módulos e Dependências (Forçar do zero)
echo "Limpando instalações anteriores da API..."
cd /var/www/myzap/api
rm -rf node_modules package-lock.json package.json

echo "Re-criando package.json (BcryptJS)..."
cat > package.json <<EOF
{
  "name": "myzap-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.9.1"
  }
}
EOF

echo "Instalando dependências limpas (Aguarde...)..."
npm install --no-audit --no-fund > /dev/null 2>&1

# 2. Configurar Banco e Estrutura
echo "Garantindo estrutura do banco de dados..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
sudo mysql -e "USE $DB_NAME; 
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"
sudo mysql -e "USE $DB_NAME; ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) AFTER id;" 2>/dev/null

# 3. Reiniciar Processo Port 5000
echo "Limpando porta 5000..."
sudo fuser -k 5000/tcp > /dev/null 2>&1

echo "Iniciando API com PM2..."
pm2 delete myzap-api > /dev/null 2>&1
pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

# 4. Validar Conectividade
echo ">>> TESTE DE CONECTIVIDADE FINAL <<<"
sleep 5
RESPONSE=$(curl -s http://127.0.0.1:5000/api/health)

if [[ $RESPONSE == *"ok"* ]]; then
    echo "✅ SUCESSO! A API está online e respondendo."
    # Reiniciar Apache para garantir roteamento
    sudo systemctl restart apache2
    echo ">>> TUDO PRONTO! Pode tentar se cadastrar agora."
else
    echo "❌ FALHA CRÍTICA: A API não iniciou corretamente."
    echo "--- ÚLTIMOS ERROS DO BACKEND (LOGS) ---"
    pm2 logs myzap-api --lines 20 --no-daemon
fi
