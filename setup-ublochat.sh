#!/bin/bash

# ==========================================================================
# MyZap - Script de Instalação Automatizada para ublochat.com.br
# ==========================================================================
# Este script instala: Apache, MySQL 8.0, phpMyAdmin, Node.js e Certbot.
# Configura o domínio ublochat.com.br com SSL e nome amigável para o Banco.
# ==========================================================================

# Cores para saída
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações Prioritárias
DOMAIN="ublochat.com.br"
PMA_ALIAS="/gerenciar-banco" # Nome amigável pedido pelo usuário
DB_NAME="ublochat_db"
DB_USER="ublochat_user"
DB_PASS=$(openssl rand -base64 12)
REPO_URL="https://github.com/jenilsonramos/myzap.git"

echo -e "${BLUE}>>> Iniciando instalação do MyZap em $DOMAIN <<<${NC}"
echo -e "${BLUE}>>> phpMyAdmin será: https://$DOMAIN$PMA_ALIAS <<<${NC}"

# 1. Atualizar o sistema
echo -e "${GREEN}1. Atualizando pacotes do sistema...${NC}"
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências básicas
echo -e "${GREEN}2. Instalando Apache, MySQL, PHP e dependências...${NC}"
sudo apt install -y apache2 mysql-server-8.0 php libapache2-mod-php php-mysql php-mbstring curl git unzip

# 3. Configurar MySQL
echo -e "${GREEN}3. Configurando Banco de Dados MySQL...${NC}"
sudo mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
sudo mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 4. Instalar phpMyAdmin
echo -e "${GREEN}4. Instalando phpMyAdmin...${NC}"
export DEBIAN_FRONTEND=noninteractive
sudo apt install -y phpmyadmin

# Configurar o Alias Amigável para o phpMyAdmin
echo -e "${GREEN}Configurando Alias Amigável ($PMA_ALIAS) para phpMyAdmin...${NC}"
sudo bash -c "cat > /etc/apache2/conf-available/phpmyadmin-custom.conf <<EOF
# Configuração Customizada MyZap
Alias $PMA_ALIAS /usr/share/phpmyadmin

<Directory /usr/share/phpmyadmin>
    Options FollowSymLinks
    DirectoryIndex index.php
    AllowOverride All
    Require all granted
</Directory>

# Desativar o acesso pelo caminho padrão /phpmyadmin por segurança
Redirect 404 /phpmyadmin
EOF"

sudo a2enconf phpmyadmin-custom
sudo a2disconf phpmyadmin > /dev/null 2>&1 # Desativa o padrão se existir

# 5. Instalar Node.js e NPM
echo -e "${GREEN}5. Instalando Node.js (v20)...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 6. Clonar e construir o projeto MyZap
echo -e "${GREEN}6. Preparando o projeto MyZap...${NC}"
sudo rm -rf /var/www/myzap # Limpar se já existir para nova instalação
sudo git clone $REPO_URL /var/www/myzap

cd /var/www/myzap
sudo npm install
sudo npm run build

# 7. Configurar VirtualHost do Apache
echo -e "${GREEN}7. Configurando Apache VirtualHost para $DOMAIN...${NC}"
VHOST_CONF="/etc/apache2/sites-available/myzap.conf"
sudo bash -c "cat > $VHOST_CONF <<EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    DocumentRoot /var/www/myzap/dist

    <Directory /var/www/myzap/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted

        # Redirecionamento para SPA (Vite)
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_URI} !^$PMA_ALIAS [NC]
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy Reverso para a API Node.js
    ProxyPreserveHost On
    ProxyPass /api http://localhost:5000/api
    ProxyPassReverse /api http://localhost:5000/api

    ErrorLog \${APACHE_LOG_DIR}/myzap_error.log
    CustomLog \${APACHE_LOG_DIR}/myzap_access.log combined
</VirtualHost>
EOF"

sudo a2ensite myzap.conf
sudo a2enmod rewrite proxy proxy_http
sudo systemctl restart apache2

# 8. Ativar SSL com Certbot
echo -e "${GREEN}8. Ativando SSL com Certbot para $DOMAIN...${NC}"
sudo apt install -y certbot python3-certbot-apache
# Nota: O usuário deve executar o certbot manualmente se estiver em um ambiente interativo,
# ou podemos tentar automatizar se ele tiver o email.
# sudo certbot --apache -d $DOMAIN --non-interactive --agree-tos -m financeiro@ublochat.com.br

echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}PREPARAÇÃO CONCLUÍDA!${NC}"
echo -e "Domínio: https://$DOMAIN"
echo -e "Banco de Dados: $DB_NAME"
echo -e "Usuário DB: $DB_USER"
echo -e "Senha DB: $DB_PASS"
echo -e "phpMyAdmin (Link Amigável): https://$DOMAIN$PMA_ALIAS"
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}Próximo passo: Execute o comando abaixo no seu VPS:${NC}"
echo -e "${BLUE}sudo certbot --apache -d $DOMAIN${NC}"
echo -e "${BLUE}================================================================${NC}"
