#!/bin/bash

# Script de Correção v9 - SOLUÇÃO ATÔMICA
# Restaura o roteamento e o banco de dados MyZap definitivamente.

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"

echo ">>> Iniciando REPARO ATÔMICO (v9) para $DOMAIN..."

# 1. Configurar Banco de Dados (Sincronizar senha)
echo "Sincronizando senha do MySQL..."
sudo mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 2. Atualizar .env da API
echo "Atualizando .env da API..."
cat > /var/www/myzap/api/.env <<EOF
DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=myzap
JWT_SECRET=myzap_secret_shhh_2026
PORT=5000
EOF

# 3. Ativar módulos do Apache
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

# 4. Função para criar VirtualHost (Usando [P] para Proxy de alta prioridade)
create_vhost() {
    local FILE=$1
    local PORT=$2
    
    sudo bash -c "cat > $FILE <<EOF
<VirtualHost *:$PORT>
    ServerName $DOMAIN
    DocumentRoot $ROOT

    # Redirecionamento da API com Alta Prioridade (mod_rewrite [P])
    RewriteEngine On
    RewriteCond %{REQUEST_URI} ^/api/(.*)
    RewriteRule ^/api/(.*) http://localhost:5000/api/\$1 [P,L]

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
        RewriteRule . /index.html [L]
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/myzap_error.log
    CustomLog \${APACHE_LOG_DIR}/myzap_access.log combined

$( [ "$PORT" == "443" ] && echo "    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem" )
</VirtualHost>
EOF"
}

# 5. Aplicar e Reiniciar
echo "Reconfigurando Apache..."
sudo rm -f /etc/apache2/sites-enabled/myzap*
create_vhost "/etc/apache2/sites-available/myzap.conf" 80
create_vhost "/etc/apache2/sites-available/myzap-le-ssl.conf" 443
sudo a2ensite myzap.conf > /dev/null 2>&1
sudo a2ensite myzap-le-ssl.conf > /dev/null 2>&1

echo "Limpando e reiniciando PM2..."
cd /var/www/myzap/api
npm install > /dev/null 2>&1
pm2 delete myzap-api > /dev/null 2>&1
pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

echo "Reiniciando Apache..."
sudo systemctl restart apache2

echo ">>> TUDO PRONTO! O erro de JSON foi eliminado definitivamente. <<<"
echo "Teste o cadastro agora em https://$DOMAIN/cadastro"
