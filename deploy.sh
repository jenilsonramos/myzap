#!/bin/bash
# Script de Deploy - UbloChat/MyZap
# Execute na VPS: bash deploy.sh

echo "🚀 Iniciando deploy..."

cd /var/www/myzap || exit 1

echo "📥 Baixando alterações do GitHub..."
git fetch origin
git reset --hard origin/main

echo "📦 Instalando dependências..."
npm install

echo "🔨 Reconstruindo frontend..."
npm run build

echo "♻️ Reiniciando serviços..."
pm2 restart all || systemctl restart myzap 2>/dev/null

echo "✅ Deploy concluído!"
pm2 status
