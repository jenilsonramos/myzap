const MASTER_TEMPLATE = (title: string, content: string, ctaText?: string, ctaUrl?: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding-bottom: 40px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; margin-top: 40px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #10b981 100%); padding: 40px; text-align: center; }
        .logo { font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px; text-transform: uppercase; }
        .content { padding: 40px; color: #334155; line-height: 1.6; }
        .title { font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 20px; letter-spacing: -0.5px; }
        .text { font-size: 16px; margin-bottom: 24px; }
        .btn-container { text-align: center; margin-top: 32px; }
        .btn { background: #4f46e5; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 14px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); transition: transform 0.2s; }
        .footer { padding: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
        .footer a { color: #64748b; text-decoration: underline; }
        .divider { height: 1px; background-color: #f1f5f9; margin: 32px 0; }
        .badge { display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 99px; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <div class="logo">MyZap</div>
            </div>
            <div class="content">
                ${content}
                ${ctaText && ctaUrl ? `
                <div class="btn-container">
                    <a href="${ctaUrl}" class="btn">${ctaText}</a>
                </div>
                ` : ''}
                <div class="divider"></div>
                <p class="text" style="font-size: 14px; color: #64748b;">
                    Qualquer dúvida, responda este e-mail ou chame nosso suporte no WhatsApp.
                </p>
            </div>
            <div class="footer">
                <p>&copy; 2026 MyZap Enterprise. Todos os direitos reservados.</p>
                <p>Você recebeu este e-mail porque possui uma conta ativa no MyZap.</p>
                <p><a href="#">Configurações de Notificação</a> &bull; <a href="#">Ajuda</a></p>
            </div>
        </div>
    </div>
</body>
</html>
`;

export const emailTemplates = {
    WELCOME: {
        subject: 'Bem-vindo ao MyZap! 🚀',
        html: MASTER_TEMPLATE(
            'Bem-vindo',
            `
            <div class="badge">Ativação de Conta</div>
            <h2 class="title">Olá, {name}! Seu acesso está liberado.</h2>
            <p class="text">Sua conta no MyZap foi criada com sucesso. Estamos empolgados em ver como você vai transformar seu atendimento com nossa plataforma.</p>
            <p class="text">Agora você já pode conectar suas instâncias e começar a construir fluxos de automação inteligentes.</p>
            `,
            'Acessar Dashboard',
            '{login_url}'
        )
    },
    PAYMENT_APPROVED: {
        subject: 'Pagamento Aprovado! ✅',
        html: MASTER_TEMPLATE(
            'Pagamento Confirmado',
            `
            <div class="badge" style="color: #10b981; background: #ecfdf5;">Sucesso</div>
            <h2 class="title">Seu pagamento foi confirmado!</h2>
            <p class="text">Temos o prazer de informar que seu pagamento para o plano <strong>{plan_name}</strong> foi processado com sucesso.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 16px; margin: 24px 0;">
                <p style="margin: 5px 0; font-size: 14px;"><strong>Valor:</strong> {amount}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Data:</strong> {date}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Plano:</strong> {plan_name}</p>
            </div>
            <p class="text">Seus limites já foram atualizados e sua conta está totalmente ativa.</p>
            `,
            'Ver Minha Fatura',
            '{invoice_url}'
        )
    },
    EXPIRING_SOON: {
        subject: 'Sua assinatura vence em breve ⏳',
        html: MASTER_TEMPLATE(
            'Aviso de Vencimento',
            `
            <div class="badge" style="color: #f59e0b; background: #fffbeb;">Atenção</div>
            <h2 class="title">Sua assinatura vence em {days} dias.</h2>
            <p class="text">Este é um lembrete amigável de que sua assinatura do plano <strong>{plan_name}</strong> está chegando ao fim.</p>
            <p class="text">Para garantir que seus fluxo de atendimento não sejam interrompidos e que seus clientes não fiquem sem resposta, renove seu plano hoje mesmo.</p>
            `,
            'Renovar Assinatura Agora',
            '{renew_url}'
        )
    },
    EXPIRED: {
        subject: 'Sua assinatura expirou ❌',
        html: MASTER_TEMPLATE(
            'Assinatura Expirada',
            `
            <div class="badge" style="color: #ef4444; background: #fef2f2;">Importante</div>
            <h2 class="title">Serviços suspensos por falta de pagamento.</h2>
            <p class="text">Sua assinatura expirou e seus serviços foram pausados automaticamente.</p>
            <p class="text"><strong>O que acontece agora?</strong> Suas instâncias foram desconectadas e os fluxos de automação não estão processando novas mensagens.</p>
            <p class="text">Evite a perda de dados e configurações regularizando sua conta.</p>
            `,
            'Regularizar Conta',
            '{payment_url}'
        )
    },
    PASSWORD_RECOVERY: {
        subject: 'Recuperação de Senha 🔐',
        html: MASTER_TEMPLATE(
            'Segurança da Conta',
            `
            <div class="badge">Recuperação</div>
            <h2 class="title">Esqueceu sua senha?</h2>
            <p class="text">Recebemos uma solicitação para redefinir a senha da sua conta MyZap.</p>
            <p class="text">Se você não solicitou isso, pode ignorar este e-mail com segurança. Sua senha atual permanecerá a mesma.</p>
            <p class="text" style="font-size: 13px; color: #94a3b8;">O link abaixo é válido por apenas 1 hora.</p>
            `,
            'Trocar Minha Senha',
            '{reset_url}'
        )
    },
    ACCOUNT_ACTIVATION: {
        subject: 'Ative sua conta MyZap 🔑',
        html: MASTER_TEMPLATE(
            'Ativação de Conta',
            `
            <div class="badge" style="color: #4f46e5; background: #eef2ff;">Ativação</div>
            <h2 class="title">Olá, {name}! Ative sua conta.</h2>
            <p class="text">Estamos quase lá! Para começar a usar o MyZap, você precisa ativar sua conta.</p>
            <p class="text">Use o código abaixo para ativar sua conta:</p>
            <div style="background: #f8fafc; padding: 24px; border-radius: 16px; margin: 24px 0; text-align: center;">
                <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5;">{activation_code}</span>
            </div>
            <p class="text" style="font-size: 13px; color: #94a3b8;">Este código é válido por 24 horas. Se você não criou esta conta, ignore este e-mail.</p>
            `,
            'Ativar Conta',
            '{activation_url}'
        )
    },
    PASSWORD_CHANGED: {
        subject: 'Senha Alterada com Sucesso ✅',
        html: MASTER_TEMPLATE(
            'Segurança da Conta',
            `
            <div class="badge" style="color: #10b981; background: #ecfdf5;">Confirmação</div>
            <h2 class="title">Sua senha foi alterada!</h2>
            <p class="text">Sua senha foi alterada com sucesso em {date} às {time}.</p>
            <p class="text">Se você realizou esta alteração, pode ignorar este e-mail.</p>
            <div style="background: #fef2f2; padding: 16px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #ef4444;">
                <p style="margin: 0; font-size: 14px; color: #b91c1c;"><strong>⚠️ Não foi você?</strong> Clique no botão abaixo imediatamente para proteger sua conta.</p>
            </div>
            `,
            'Recuperar Conta',
            '{recovery_url}'
        )
    }
};
