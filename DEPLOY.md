# Guia de Instalação MyZap (VPS)

Este documento descreve como realizar o deploy automatizado do painel MyZap em um servidor VPS limpo (Ubuntu 22.04+ recomendado).

## Pré-requisitos

1. Um servidor VPS com acesso root.
2. Domínio apontado para o IP do servidor (`app.ublochat.com.br`).
3. Portas 80 e 443 abertas no firewall.

## Instalação Automatizada

O script `setup.sh` automatiza a instalação de todo o ambiente:
- Apache 2
- MySQL 8.0
- phpMyAdmin
- Node.js 20 & NPM
- Certbot (SSL Let's Encrypt)

### Passos para Instalação

1. Acesse seu servidor via SSH.
2. Execute o comando abaixo para iniciar a instalação:

```bash
# Baixar o script diretamente do repositório
curl -L -O https://raw.githubusercontent.com/jenilsonramos/myzap/main/setup.sh

# Baixar o banco de dados compactado (necessário para o setup.sh)
curl -L -O https://raw.githubusercontent.com/jenilsonramos/myzap/main/setup_sql.zip

# Dar permissão de execução e rodar
chmod +x setup.sh
sudo ./setup.sh
```


## O que o script faz?

1. **Atualização**: Atualiza os repositórios e pacotes do sistema.
2. **Dependências**: Instala Apache, MySQL, PHP e Git.
3. **Banco de Dados**: Cria o banco `myzap`, configura um usuário e importa o esquema inicial (`setup.sql`).
4. **Projeto**: Clona o repositório, instala dependências do Node e realiza o `npm run build`.
5. **Web Server**: Configura o VirtualHost do Apache e ativa o módulo de reescrita.
6. **SSL**: Instala o Certbot e prepara o ambiente para HTTPS.

## Acesso após instalação

## Observação sobre Gerenciamento de Processos

Para este projeto (**Frontend Vite/React**):
- **Não é necessário o PM2**. 
- O sistema é servido estaticamente pelo **Apache**, que já roda como um serviço do sistema e garante que o painel esteja sempre online.
- O PM2 seria necessário apenas se houvesse um backend em Node.js rodando separadamente neste servidor.

## Como Atualizar o Sistema

Sempre que houver novidades, você pode atualizar seu VPS com um único comando:

```bash
cd /var/www/myzap && sudo ./update.sh
```

## Suporte

Se encontrar problemas com o Certbot (SSL), execute manualmente:
```bash
sudo certbot --apache -d app.ublochat.com.br
```
