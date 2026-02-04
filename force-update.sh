#!/bin/bash
echo "🚀 Iniciando REPARO FORÇADO do MyZap..."

# 1. Limpar mudanças locais que travam o pull
echo "🧹 Limpando mudanças locais..."
git checkout .
git reset --hard origin/main

# 2. Puxar código novo
echo "⬇️ Forçando Pull da Main..."
git pull origin main

# 3. Atualizar dependências
echo "📦 Atualizando dependências da API..."
cd api
npm install
cd ..

# 4. Limpar e Reiniciar PM2 (Garante que pegue o package.json novo)
echo "♻️ Resetando PM2..."
pm2 delete all
pm2 start api/server.js --name "myzap-api"
pm2 save

echo "✅ REPARO CONCLUÍDO!"
echo "👉 Verifique agora com: pm2 list"
echo "👉 Tente acessar: https://ublochat.com.br/api/health"
