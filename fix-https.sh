#!/bin/bash

# Script de Correção v6 - REPARO DE EMERGÊNCIA
# Resolve o erro de sintaxe 'pi/d' e restaura o Apache

echo ">>> Iniciando Reparo de Emergência do Apache..."

# 1. Ativar módulos necessários
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

# 2. Arquivos de destino
FILES=("/etc/apache2/sites-available/myzap.conf" "/etc/apache2/sites-available/myzap-le-ssl.conf")

for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        echo "Limpando e corrigindo: $FILE"
        
        # Backup de segurança
        sudo cp "$FILE" "${FILE}.bak"

        # Remover linhas corrompidas por versões anteriores do script (incluindo pi/d e similares)
        # Usamos '|' como delimitador para evitar problemas com '/'
        sudo sed -i '\|pi/d|d' "$FILE"
        sudo sed -i '\|api/d|d' "$FILE"
        sudo sed -i '\|# Proxy Reverso|d' "$FILE"
        sudo sed -i '\|ProxyPreserveHost|d' "$FILE"
        sudo sed -i '\|ProxyPass /api|d' "$FILE"
        sudo sed -i '\|ProxyPassReverse /api|d' "$FILE"
        sudo sed -i '\|RewriteCond %{REQUEST_URI} !^/api|d' "$FILE"

        # Inserir o Proxy Reverso antes da linha do ErrorLog de forma segura
        sudo sed -i '/ErrorLog/i \    # Proxy Reverso para a API\n    ProxyPreserveHost On\n    ProxyPass /api http://localhost:5000/api\n    ProxyPassReverse /api http://localhost:5000/api' "$FILE"

        # Inserir a exceção do Rewrite antes da regra do index.html
        sudo sed -i '\|RewriteRule . /index.html|i \        RewriteCond %{REQUEST_URI} !^/api [NC]' "$FILE"
    fi
done

# 3. Validar sintaxe antes de reiniciar
echo "Validando configuração..."
if sudo apache2ctl configtest; then
    echo "Sintaxe OK! Reiniciando Apache..."
    sudo systemctl restart apache2
    echo ">>> REPARO CONCLUÍDO COM SUCESSO! <<<"
else
    echo "ERRO: O Apache ainda aponta erros. Tentando restaurar backup..."
    for FILE in "${FILES[@]}"; do
        if [ -f "${FILE}.bak" ]; then
            sudo cp "${FILE}.bak" "$FILE"
        fi
    done
    sudo systemctl restart apache2
    echo "Backup restaurado para evitar que o servidor fique fora do ar."
fi
