
export enum AppView {
  INSTANCES = 'INSTANCES',
  ANALYTICS = 'ANALYTICS',
  CHAT = 'CHAT',
  CONTACTS = 'CONTACTS',
  CAMPAIGNS = 'CAMPAIGNS',
  SETTINGS = 'SETTINGS',
  FLOWBUILDER = 'FLOWBUILDER',
  FLOWS_LIST = 'FLOWS_LIST',
  MY_PLAN = 'MY_PLAN',
  AI_INTEGRATION = 'AI_INTEGRATION',
  ADMIN = 'ADMIN',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  RECOVER = 'RECOVER',
  CHATBOT = 'CHATBOT',
  SERVER_HEALTH = 'SERVER_HEALTH',
  API_DOCS = 'API_DOCS',
}

export interface Flow {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  instances: string[]; // IDs das instâncias vinculadas
  updatedAt: string;
  stats: {
    totalexecutions: number;
    successRate: number;
  };
}


export enum InstanceStatus {
  CONNECTED = 'CONECTADO',
  DISCONNECTED = 'DESCONECTADO',
  INITIALIZING = 'INICIANDO...',
}

export interface Instance {
  id: string;
  name: string;
  status: InstanceStatus;
  batteryLevel: number | null;
}

export interface Stat {
  label: string;
  value: string;
  subValue?: string;
  icon: string;
  colorClass: string;
  trend?: string;
}
