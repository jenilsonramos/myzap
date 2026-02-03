#!/bin/bash

# ==========================================================================
# MyZap - Script de Correção da API e Início do Serviço
# ==========================================================================

# Configurações do Banco (Baseadas na instalação ublochat.com.br)
DB_NAME="ublochat_db"
DB_USER="ublochat_user"
DB_PASS="uBoX4+5pacw2WJBn"
DB_HOST="localhost"
JWT_SECRET="myzap_secret_2026"

echo ">>> Iniciando Correção da API <<<"

# 1. Criar arquivo .env na pasta da API
echo "Configurando arquivo .env..."
cat <<EOF > /var/www/myzap/api/.env
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
PORT=3001
EOF

# 2. Instalar dependências da API se necessário
echo "Verificando dependências da API..."
cd /var/www/myzap/api
npm install

# 3. Instalar PM2 globalmente se não existir
if ! command -v pm2 &> /dev/null
then
    echo "PM2 não encontrado. Instalando..."
    sudo npm install -g pm2
fi

# 4. Iniciar/Reiniciar a API com PM2
echo "Iniciando API com PM2..."
pm2 delete myzap-api 2>/dev/null
pm2 start server.js --name "myzap-api"
pm2 save

echo "✅ API configurada e iniciada com sucesso!"
echo "Agora tente se cadastrar novamente em https://ublochat.com.br"
echo ">>> PROCESSO CONCLUÍDO! <<<"
