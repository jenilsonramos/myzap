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

        // Se for 204 No Content
        if (response.status === 204) return null;

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || data.error || `Error ${response.status}: ${response.statusText}`);
        }
        return data;
    }

    // 1. Criar Instância
    async createInstance(instanceName, token) {
        // Evolution v2 payload format might vary, check docs if available. 
        // Standard v1/v2 usually accepts: { instanceName, token, qrcode: true }
        return this._request('/instance/create', 'POST', {
            instanceName: instanceName,
            token: token, // Opcional: token de segurança da instância
            qrcode: true
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
}

module.exports = EvolutionService;
