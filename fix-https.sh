#!/bin/bash

# Script de Correção v4 - REPARO TOTAL
# Corrige o roteamento do Apache para MyZap (Mixed Content + JSON Error)

echo ">>> Iniciando REPARO TOTAL do Apache para MyZap..."

# 1. Ativar módulos
sudo a2enmod proxy proxy_http rewrite ssl headers

# 2. Função para processar arquivos
fix_vhost() {
    local FILE=$1
    if [ -f "$FILE" ]; then
        echo "Corrigindo: $FILE"
        
        # Limpar configurações de proxy antigas (para evitar duplicidade)
        sudo sed -i '/# Proxy Reverso para a API/d' "$FILE"
        sudo sed -i '/ProxyPreserveHost On/d' "$FILE"
        sudo sed -i '/ProxyPass \/api/d' "$FILE"
        sudo sed -i '/ProxyPassReverse \/api/d' "$FILE"
        sudo sed -i '/RewriteCond %{REQUEST_URI} !^/api/d' "$FILE"

        # Inserir Proxy Reverso antes do Log de Erros
        sudo sed -i '/ErrorLog/i \    # Proxy Reverso para a API\n    ProxyPreserveHost On\n    ProxyPass /api http://localhost:5000/api\n    ProxyPassReverse /api http://localhost:5000/api\n' "$FILE"

        # Inserir exceção de Rewrite exatamente antes do index.html
        sudo sed -i '/RewriteRule . \/index.html/i \        RewriteCond %{REQUEST_URI} !^/api [NC]' "$FILE"
        
        echo "Concluído: $FILE"
    fi
}

# 3. Aplicar em todos os arquivos habilitados (HTTP e HTTPS)
for f in /etc/apache2/sites-enabled/*.conf; do
    fix_vhost "$f"
done

# 4. Reiniciar Apache
echo "Reiniciando servidor..."
sudo systemctl restart apache2

echo ">>> TUDO PRONTO! Tente se cadastrar agora."
echo "Certifique-se de que a API está rodando: pm2 restart myzap-api"
