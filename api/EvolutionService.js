const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)).catch(() => global.fetch(...args));

class EvolutionService {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl?.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = apiKey;
    }

    async _request(endpoint, method = 'GET', body = null) {
        if (!this.baseUrl || !this.apiKey) {
            throw new Error('Evolution API URL or Key not configured');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.apiKey
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        console.log(`📡 [Evolution] ${method} ${url}`);
        const response = await fetch(url, options);

        if (response.status === 204) return null;

        const text = await response.text();
        console.log(`📥 [Evolution] Response (${response.status}):`, text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('❌ Falha ao parsear JSON da Evolution:', e.message);
            throw new Error(`Evolution API Error (${response.status}): ${text.slice(0, 100)}`);
        }

        if (!response.ok) {
            const errorMsg = data.response?.message || data.message || data.error || JSON.stringify(data);
            console.error(`❌ Erro da API Evolution [${response.status}]:`, errorMsg);
            throw new Error(errorMsg);
        }
        return data;
    }

    // 1. Criar Instância
    async createInstance(instanceName, token) {
        // Evolution v2 payload format might vary, check docs if available. 
        // Standard v1/v2 usually accepts: { instanceName, token, qrcode: true }
        return this._request('/instance/create', 'POST', {
            instanceName: instanceName,
            token: token ? String(token) : undefined,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
        });
    }

    // 2. Listar Instâncias
    async fetchInstances() {
        // Evolution retorna array de objetos ou objeto com array
        // Endpoint v2: /instance/fetchInstances
        return this._request('/instance/fetchInstances', 'GET');
    }

    // 3. Deletar Instância
    async deleteInstance(instanceName) {
        return this._request(`/instance/delete/${instanceName}`, 'DELETE');
    }

    // 4. Conectar / Obter QR Code
    // Na v2, geralmente é /instance/connect/:instanceName
    async connectInstance(instanceName) {
        return this._request(`/instance/connect/${instanceName}`, 'GET');
    }

    // 5. Obter Status da Conexão
    async getConnectionState(instanceName) {
        return this._request(`/instance/connectionState/${instanceName}`, 'GET');
    }

    // 6. Configurar Webhook
    async setWebhook(instanceName, webhookUrl, enabled = true) {
        return this._request(`/webhook/set/${instanceName}`, 'POST', {
            webhook: {
                url: webhookUrl,
                webhookByEvents: false,
                events: [
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'MESSAGES_DELETE',
                    'SEND_MESSAGE',
                    'CONNECTION_UPDATE'
                ],
                enabled: enabled
            }
        });
    }

    // 7. Enviar Texto
    async sendText(instanceName, number, text) {
        return this._request(`/message/sendText/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            text,
            delay: 1200
        });
    }

    // 8. Enviar Mídia
    async sendImage(instanceName, number, url, caption = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'image',
            media: url,
            caption
        });
    }

    async sendVideo(instanceName, number, url, caption = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'video',
            media: url,
            caption
        });
    }

    async sendAudio(instanceName, number, url) {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'audio',
            media: url,
            ptt: true
        });
    }

    async sendDocument(instanceName, number, url, fileName = 'documento', caption = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'document',
            media: url,
            fileName,
            caption
        });
    }

    // 9. Bloquear/Desbloquear Contato
    async blockUnblockContact(instanceName, remoteJid, block = true) {
        // Remove @s.whatsapp.net para garantir compatibilidade caso a API prefira apenas o número
        const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');

        console.log(`🚫 [Evolution] Bloqueando/Desbloqueando: ${cleanNumber} (${block ? 'block' : 'unblock'})`);

        return this._request(`/chat/blockUnblock/${instanceName}`, 'POST', {
            number: cleanNumber,
            action: block ? 'block' : 'unblock'
        });
    }
}

module.exports = EvolutionService;
