#!/bin/bash

# Script de Correção v14 - REPARO DE BANCO DE ALTA PRECISÃO
# Resolve de vez o erro 'Unknown column name'

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"
DB_NAME="myzap"

echo ">>> Iniciando REPARO v14 (Correção de MySQL) <<<"

# 1. Correção Cirúrgica do Banco de Dados
echo "Corrigindo tabela 'users' no banco '$DB_NAME'..."

# Tenta criar a tabela se não existir
sudo mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
sudo mysql -e "USE $DB_NAME; 
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"

# Adiciona a coluna 'name' de forma compatível (sem IF NOT EXISTS que pode falhar)
# Primeiro verificamos se ela já existe para não dar erro de duplicidade
COLUMN_EXISTS=$(sudo mysql -N -s -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND COLUMN_NAME='name';")

if [ "$COLUMN_EXISTS" -eq 0 ]; then
    echo "Coluna 'name' não encontrada. Adicionando agora..."
    sudo mysql -e "USE $DB_NAME; ALTER TABLE users ADD COLUMN name VARCHAR(255) AFTER id;"
    echo "Coluna 'name' adicionada com sucesso!"
else
    echo "Coluna 'name' já existe no banco de dados."
fi

# 2. Sincronizar Usuário e Senha
sudo mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" || \
sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS'; GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 3. Reiniciar PM2 (Garantir que a API pegue a nova estrutura)
echo "Reiniciando API..."
cd /var/www/myzap/api
pm2 restart myzap-api || pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

# 4. Validar Conexão
echo ">>> TESTE DE SAÚDE <<<"
sleep 2
RESPONSE=$(curl -s http://127.0.0.1:5000/api/health)
if [[ $RESPONSE == *"ok"* ]]; then
    echo "✅ Backend Online!"
else
    echo "❌ Backend ainda com problemas. Verifique 'pm2 logs myzap-api'"
fi

echo ">>> REPARO v14 CONCLUÍDO! <<<"
echo "A coluna 'name' foi verificada e corrigida. Pode tentar o cadastro agora!"
