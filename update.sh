#!/bin/bash

# Script de atualização automática para MyZap

echo "🔄 Iniciando atualização do MyZap..."

# 1. Puxar as últimas alterações do Git
echo "⬇️ Baixando código atualizado..."
git pull origin main

# 2. Instalar dependências (caso tenha algo novo)
echo "📦 Verificando dependências..."
npm install

# 3. Build do projeto
echo "🏗️ Construindo projeto (build)..."
npm run build

# 4. Reiniciar serviços
if command -v pm2 &> /dev/null; then
    echo "♻️ Reiniciando PM2..."
    pm2 restart all
else
    echo "⚠️ PM2 não encontrado. Se estiver usando Apache/Systemd, verifique se o serviço precisa reiniciar."
fi

echo "✅ Atualização concluída com sucesso!"
