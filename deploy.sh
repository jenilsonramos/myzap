#!/bin/bash
# Script de Atualização Total do MyZap Pro (Frontend + Backend)

echo "🚀 Iniciando atualização do MyZap Pro..."

# 1. Puxar as novidades do GitHub
echo "📂 Sincronizando com GitHub..."
git fetch origin
git reset --hard origin/main

# 2. Instalar dependências se necessário
echo "📦 Instalando dependências..."
npm install
cd api && npm install && cd ..

# 3. Build do Frontend
echo "🏗️ Gerando build do Frontend..."
npm run build

# 4. Reiniciar o Backend via PM2
echo "🔄 Reiniciando Backend (PM2)..."
pm2 restart all || pm2 start api/server.js --name myzap-api

echo "✅ Sistema atualizado e reiniciado com sucesso!"
pm2 status
