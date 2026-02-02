#!/bin/bash

# Script de Correção Automática - MyZap HTTPS/Proxy
# Este script deve ser executado no VPS com sudo.

echo ">>> Iniciando correção de Proxy Reverso para HTTPS..."

# 1. Ativar módulos do Apache
echo "Ativando módulos proxy e proxy_http..."
sudo a2enmod proxy proxy_http rewrite

# 2. Configurar o VirtualHost
VHOST_FILE="/etc/apache2/sites-available/myzap.conf"

if [ ! -f "$VHOST_FILE" ]; then
    echo "ERRO: Arquivo de configuração $VHOST_FILE não encontrado."
    exit 1
fi

# Verificar se o Proxy já está configurado para evitar duplicidade
if grep -q "ProxyPass /api" "$VHOST_FILE"; then
    echo "A configuração de Proxy já existe no arquivo."
else
    echo "Injetando configuração de Proxy Reverso..."
    # Inserir antes da linha ErrorLog
    sudo sed -i '/ErrorLog/i \
    # Proxy Reverso para a API\n    ProxyPreserveHost On\n    ProxyPass /api http://localhost:5000/api\n    ProxyPassReverse /api http://localhost:5000/api\n' "$VHOST_FILE"
fi

# 3. Reiniciar o Apache
echo "Reiniciando Apache..."
sudo systemctl restart apache2

echo ">>> CORREÇÃO APLICADA COM SUCESSO! <<<"
echo "Agora o sistema deve funcionar via HTTPS sem erros de Mixed Content."
