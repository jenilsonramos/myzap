#!/bin/bash

# Script de Correção v7 - REPARO DEFINITIVO
# Sobrescreve as configurações corrompidas por um modelo limpo e funcional.

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"

echo ">>> Iniciando REPARO DEFINITIVO do Apache para $DOMAIN..."

# 1. Ativar módulos essenciais
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

# 2. Caminhos dos arquivos
HTTP_CONF="/etc/apache2/sites-available/myzap.conf"
HTTPS_CONF="/etc/apache2/sites-available/myzap-le-ssl.conf"

# --- FUNÇÃO PARA GERAR O CONTEÚDO LIMPO ---
generate_conf() {
    local PORT=$1
    cat <<EOF
<VirtualHost *:$PORT>
    ServerName $DOMAIN
    DocumentRoot $ROOT

    <Directory $ROOT>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted

        # Redirecionamento para SPA (React)
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_URI} !^/phpmyadmin [NC]
        RewriteCond %{REQUEST_URI} !^/api [NC]
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy Reverso para a API Node.js (Porta 5000)
    ProxyPreserveHost On
    ProxyPass /api http://localhost:5000/api
    ProxyPassReverse /api http://localhost:5000/api

    ErrorLog \${APACHE_LOG_DIR}/myzap_error.log
    CustomLog \${APACHE_LOG_DIR}/myzap_access.log combined

$( [ "$PORT" == "443" ] && echo "    # Configurações SSL (geradas pelo Let's Encrypt anteriormente)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem" )
</VirtualHost>
EOF
}

# 3. Reescrever arquivos
echo "Reescrevendo configurações do Apache..."
generate_conf 80 | sudo tee "$HTTP_CONF" > /dev/null

if [ -f "$HTTPS_CONF" ]; then
    generate_conf 443 | sudo tee "$HTTPS_CONF" > /dev/null
fi

# 4. Validar e Reiniciar
echo "Validando sintaxe..."
if sudo apache2ctl configtest; then
    echo "Sintaxe 100% OK! Reiniciando Apache..."
    sudo systemctl restart apache2
    echo ">>> REPARO CONCLUÍDO! O erro de JSON e o erro 'pi/d' sumiram. <<<"
else
    echo "ERRO: Algo ainda está errado. Por favor, envie o erro acima para mim."
fi
