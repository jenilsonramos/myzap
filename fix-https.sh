#!/bin/bash

# Script de Correção v8 - SUPER LIMPEZA
# Remove arquivos fantasmas e restaura o roteamento MyZap

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"

echo ">>> Iniciando SUPER LIMPEZA do Apache para $DOMAIN..."

# 1. Ativar módulos essenciais
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

# 2. REMOÇÃO AGRESSIVA de arquivos antigos (Limpa qualquer erro 'pi/d')
echo "Limpando arquivos de configuração antigos..."
sudo rm -f /etc/apache2/sites-available/myzap.conf
sudo rm -f /etc/apache2/sites-available/myzap-le-ssl.conf
sudo rm -f /etc/apache2/sites-enabled/myzap.conf
sudo rm -f /etc/apache2/sites-enabled/myzap-le-ssl.conf

# 3. Função para gerar o conteúdo direto no arquivo
create_vhost() {
    local FILE=$1
    local PORT=$2
    
    sudo bash -c "cat > $FILE <<EOF
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

$( [ "$PORT" == "443" ] && echo "    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem" )
</VirtualHost>
EOF"
}

# 4. Re-criar os arquivos
echo "Re-criando configurações limpas..."
create_vhost "/etc/apache2/sites-available/myzap.conf" 80
create_vhost "/etc/apache2/sites-available/myzap-le-ssl.conf" 443

# 5. Re-habilitar
echo "Habilitando sites..."
sudo a2ensite myzap.conf > /dev/null 2>&1
sudo a2ensite myzap-le-ssl.conf > /dev/null 2>&1

# 6. Validar e Reiniciar
echo "Validando sintaxe..."
if sudo apache2ctl configtest; then
    echo "Sintaxe 100% OK! Reiniciando Apache..."
    sudo systemctl restart apache2
    echo ">>> REPARO CONCLUÍDO COM SUCESSO! <<<"
    echo "O erro de sintaxe 'pi/d' foi eliminado e o Proxy Reverso está ativo."
else
    echo "ERRO CRÍTICO: O Apache ainda detectou erros. Verifique a saída acima."
fi
