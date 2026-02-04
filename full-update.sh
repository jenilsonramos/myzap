#!/bin/bash
echo "🚀 Iniciando ATUALIZAÇÃO COMPLETA (Frontend + Backend)..."

# 1. Puxar código novo
echo "⬇️ Puxando atualizações do GitHub..."
git fetch origin main
git reset --hard origin/main

# 2. Atualizar Backend (API)
echo "📦 Atualizando dependências do Backend..."
cd api
npm install
cd ..

# 3. Atualizar Frontend
echo "🎨 Atualizando dependências do Frontend..."
npm install
echo "🏗️ Construindo o Frontend (Build)..."
npm run build

# 4. Reiniciar PM2
echo "♻️ Reiniciando serviços no PM2..."
pm2 restart all || pm2 start api/server.js --name "myzap-api"
pm2 save

echo "✅ ATUALIZAÇÃO CONCLUÍDA!"
echo "👉 Verifique a versão em: https://ublochat.com.br/api/health"
echo "👉 Limpe o cache do seu navegador (CTRL + F5) para ver as mudanças no chat."
