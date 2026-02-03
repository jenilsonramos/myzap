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
    echo "✅ Importação concluída com sucesso!"
    
    echo "🔧 Aplicando correções profundas de esquema..."
    # Adicionar colunas se faltarem
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) FIRST;"
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';"
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(100) DEFAULT 'Teste Grátis';"
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at DATETIME;"
    
    # Migrar dados de firstname/lastname para name se name estiver vazio
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "UPDATE users SET name = CONCAT(IFNULL(firstname,''), ' ', IFNULL(lastname,'')) WHERE name IS NULL OR name = '';"
    
    echo "✅ Esquema reparado e nomes migrados."
    echo "Agora seus dados devem estar acessíveis em https://ublochat.com.br"
else
    echo "❌ Erro ao importar dados no MySQL."
    exit 1
fi

# Limpeza (opcional)
# rm $SQL_FILE

echo ">>> PROCESSO CONCLUÍDO! <<<"
