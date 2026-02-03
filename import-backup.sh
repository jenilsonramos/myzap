#!/bin/bash

# ==========================================================================
# MyZap - Script de Restauração de Backup
# ==========================================================================
# Descompacta setup_sql.zip e importa para o banco ublochat_db
# ==========================================================================

# Configurações do Destino
NEW_DB="ublochat_db"
NEW_USER="ublochat_user"
NEW_PASS="uBoX4+5pacw2WJBn"
ZIP_FILE="setup_sql.zip"
SQL_FILE="setup.sql"

echo ">>> Iniciando Restauração de Backup <<<"

# 1. Verificar se o arquivo zip existe
if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Erro: Arquivo $ZIP_FILE não encontrado."
    exit 1
fi

# 2. Descompactar
echo "Descompactando $ZIP_FILE..."
unzip -o $ZIP_FILE

# 3. Verificar se o SQL foi extraído
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Erro: O arquivo $SQL_FILE não foi encontrado após descompactar."
    exit 1
fi

# 4. Importar para o banco
echo "Importando dados para o banco $NEW_DB..."
mysql -u $NEW_USER -p$NEW_PASS $NEW_DB < $SQL_FILE

if [ $? -eq 0 ]; then
    echo "✅ Restauração concluída com sucesso!"
    echo "Agora seus dados devem estar acessíveis em https://ublochat.com.br"
else
    echo "❌ Erro ao importar dados no MySQL."
    exit 1
fi

# Limpeza (opcional)
# rm $SQL_FILE

echo ">>> PROCESSO CONCLUÍDO! <<<"
