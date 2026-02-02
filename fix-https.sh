#!/bin/bash

# Script de Correção Automática v2 - MyZap HTTPS/Proxy
# Este script deve ser executado no VPS com sudo.

echo ">>> Iniciando correção avançada de Proxy Reverso para HTTPS..."

# 1. Ativar módulos do Apache
echo "Ativando módulos proxy e proxy_http..."
sudo a2enmod proxy proxy_http rewrite

# 2. Localizar arquivos de configuração
CONFIG_FILES=("/etc/apache2/sites-available/myzap.conf" "/etc/apache2/sites-available/myzap-le-ssl.conf")

for VHOST_FILE in "${CONFIG_FILES[@]}"; do
    if [ -f "$VHOST_FILE" ]; then
        echo "Processando arquivo: $VHOST_FILE"
        
        # Verificar se o Proxy já está configurado para evitar duplicidade
        if grep -q "ProxyPass /api" "$VHOST_FILE"; then
            echo "A configuração de Proxy já existe em $(basename $VHOST_FILE)."
        else
            echo "Injetando configuração de Proxy Reverso em $(basename $VHOST_FILE)..."
            # Inserir antes da linha ErrorLog
            sudo sed -i '/ErrorLog/i \
    # Proxy Reverso para a API\n    ProxyPreserveHost On\n    ProxyPass /api http://localhost:5000/api\n    ProxyPassReverse /api http://localhost:5000/api\n' "$VHOST_FILE"
        fi
    else
        echo "Aviso: Arquivo $VHOST_FILE não encontrado. Pulando..."
    fi
done

# 3. Reiniciar o Apache
echo "Reiniciando Apache..."
sudo systemctl restart apache2

echo ">>> CORREÇÃO APLICADA COM SUCESSO! <<<"
echo "Agora o sistema deve funcionar via HTTPS sem erros de Mixed Content."
