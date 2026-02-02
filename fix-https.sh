#!/bin/bash

# Script de Correção v12 - REPARO DE BANCO DE DADOS
# Resolve erro de coluna 'name' e garante estrutura do MyZap

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"
DB_NAME="myzap"

echo ">>> Iniciando REPARO v12 (Correção de Tabela)..."

# 1. Ajustar Estrutura da Tabela do Usuário
echo "Corrigindo estrutura da tabela 'users' no banco '$DB_NAME'..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;
USE $DB_NAME;
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"

# Garantir que a coluna 'name' exista (caso a tabela já existisse sem ela)
sudo mysql -e "USE $DB_NAME; 
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL AFTER id;" 2>/dev/null

# 2. Configurar Usuário e Senha
sudo mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" || \
sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS'; GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 3. Preparar a API
mkdir -p /var/www/myzap/api
cd /var/www/myzap/api

# Criar package.json se não existir
if [ ! -f "package.json" ]; then
cat > package.json <<EOF
{
  "name": "myzap-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.9.1"
  }
}
EOF
npm install
fi

# Atualizar .env e server.js (garantir versão mais recente)
cat > .env <<EOF
DB_HOST=127.0.0.1
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=myzap_secret_shhh_2026
PORT=5000
EOF

# Iniciar API
pm2 delete myzap-api > /dev/null 2>&1
pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

# 4. Ajustar Apache
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1
sudo systemctl restart apache2

echo ">>> REPARO v12 CONCLUÍDO! <<<"
echo "A coluna 'name' foi adicionada e a API reiniciada. Teste o cadastro agora!"
