#!/bin/bash

# Script de Correção v5 - REPARO SEGURO
# Resolve o conflito entre Frontend (React) e Backend (API) no Apache

echo ">>> Iniciando Reparo Seguro do Apache..."

# 1. Ativar módulos necessários
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

# 2. Arquivos de destino
FILES=("/etc/apache2/sites-available/myzap.conf" "/etc/apache2/sites-available/myzap-le-ssl.conf")

for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        echo "Ajustando: $FILE"
        
        # Limpar tentativas anteriores de forma limpa
        sudo sed -i '/ProxyPreserveHost/d' "$FILE"
        sudo sed -i '/ProxyPass \/api/d' "$FILE"
        sudo sed -i '/ProxyPassReverse \/api/d' "$FILE"
        sudo sed -i '/# Proxy Reverso/d' "$FILE"
        sudo sed -i '/RewriteCond %{REQUEST_URI} !^/api/d' "$FILE"

        # Inserir o Proxy Reverso antes da linha do ErrorLog
        # Usamos múltiplas chamadas sed para garantir compatibilidade total
        sudo sed -i '/ErrorLog/i \    ProxyPreserveHost On' "$FILE"
        sudo sed -i '/ErrorLog/i \    ProxyPass /api http://localhost:5000/api' "$FILE"
        sudo sed -i '/ErrorLog/i \    ProxyPassReverse /api http://localhost:5000/api' "$FILE"

        # Inserir a exceção do Rewrite EXATAMENTE antes da regra do index.html
        sudo sed -i '/RewriteRule . \/index.html/i \        RewriteCond %{REQUEST_URI} !^/api [NC]' "$FILE"
    fi
done

# 3. Validar sintaxe antes de reiniciar
echo "Validando configuração..."
if sudo apache2ctl configtest; then
    echo "Sintaxe OK! Reiniciando Apache..."
    sudo systemctl restart apache2
    echo ">>> REPARO CONCLUÍDO COM SUCESSO! <<<"
else
    echo "ERRO: A configuração continua com falha. Verifique os logs acima."
fi
