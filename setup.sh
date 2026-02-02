#!/bin/bash

# ==========================================================================
# MyZap - Script de Instalação Automatizada (Ubuntu/Debian)
# ==========================================================================
# Este script instala: Apache, MySQL 8.0, phpMyAdmin, Node.js e Certbot.
# Configura o domínio app.ublochat.com.br com SSL.
# ==========================================================================

# Cores para saída
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
DOMAIN="app.ublochat.com.br"
DB_NAME="myzap"
DB_USER="myzap_user"
DB_PASS=$(openssl rand -base64 12)
REPO_URL="https://github.com/jenilsonramos/myzap.git"

echo -e "${BLUE}>>> Iniciando instalação do MyZap em $DOMAIN <<<${NC}"

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

# Importar o esquema se o arquivo setup_sql.zip existir
if [ -f "setup_sql.zip" ]; then
    echo -e "${GREEN}Descompactando e importando esquema SQL...${NC}"
    sudo apt install -y unzip
    unzip -o setup_sql.zip
    sudo mysql $DB_NAME < setup.sql
elif [ -f "setup.sql" ]; then
    echo -e "${GREEN}Importando esquema SQL direto...${NC}"
    sudo mysql $DB_NAME < setup.sql
else
    echo -e "${RED}AVISO: setup.sql ou setup_sql.zip não encontrado. Pulei a importação do banco.${NC}"
fi

# 4. Instalar phpMyAdmin
echo -e "${GREEN}4. Instalando phpMyAdmin...${NC}"
export DEBIAN_FRONTEND=noninteractive
sudo apt install -y phpmyadmin
# Garantir que o phpMyAdmin seja incluído no Apache
if [ ! -f "/etc/apache2/conf-available/phpmyadmin.conf" ]; then
    sudo ln -s /etc/phpmyadmin/apache.conf /etc/apache2/conf-available/phpmyadmin.conf
fi
sudo a2enconf phpmyadmin

# 5. Instalar Node.js e NPM
echo -e "${GREEN}5. Instalando Node.js (v20)...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 6. Clonar e construir o projeto MyZap
echo -e "${GREEN}6. Preparando o projeto MyZap...${NC}"
if [ ! -d "/var/www/myzap" ]; then
    sudo git clone $REPO_URL /var/www/myzap
fi

cd /var/www/myzap
sudo npm install
sudo npm run build

# 7. Configurar VirtualHost do Apache
echo -e "${GREEN}7. Configurando Apache VirtualHost...${NC}"
VHOST_CONF="/etc/apache2/sites-available/myzap.conf"
sudo bash -c "cat > $VHOST_CONF <<EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    DocumentRoot /var/www/myzap/dist

    <Directory /var/www/myzap/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted

        # Redirecionamento para SPA (Vite) ignorando arquivos reais e /phpmyadmin
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
</VirtualHost>
EOF"

sudo a2ensite myzap.conf
sudo a2enmod rewrite
sudo systemctl restart apache2

# 8. Ativar SSL com Certbot
echo -e "${GREEN}8. Ativando SSL com Certbot para $DOMAIN...${NC}"
sudo apt install -y certbot python3-certbot-apache

echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "Domínio: https://$DOMAIN"
echo -e "Banco de Dados: $DB_NAME"
echo -e "Usuário DB: $DB_USER"
echo -e "phpMyAdmin: https://$DOMAIN/phpmyadmin"
echo -e "${BLUE}================================================================${NC}"

# Script de Atualização Rápida
cat > /var/www/myzap/update.sh <<EOF
#!/bin/bash
echo "Atualizando MyZap..."
cd /var/www/myzap
git pull origin main
npm run build
echo "Sistema atualizado!"
EOF
chmod +x /var/www/myzap/update.sh

