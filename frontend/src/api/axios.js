import axios from 'axios';
import { devLogger } from '../utils/logger';

// ============================================================================
// Backend Connection Configuration
// ============================================================================
// Toggle USE_NGROK to true for ngrok, or use VITE_API_URL in .env
const USE_NGROK = true; 

export const LOCAL_URL = 'http://localhost:8000';
export const NGROK_URL = 'https://dawdlingly-pseudoinsane-pa.ngrok-free.dev';

// Priority: 1. Environment variable (e.g. Vercel) -> 2. USE_NGROK toggle -> 3. Localhost
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (USE_NGROK ? NGROK_URL : LOCAL_URL);

console.log(`[MIRRORMIND][API] Connected to backend at: ${API_BASE_URL}`);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    // Skip ngrok browser interstitial warning screen for API calls
    'ngrok-skip-browser-warning': 'true',
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  devLogger.log('info', 'API', `REQ: ${config.method.toUpperCase()} ${config.url}`, config.data || config.params);
  return config;
});

api.interceptors.response.use(
  (response) => {
    devLogger.log('success', 'API', `RES: ${response.config.method.toUpperCase()} ${response.config.url} [${response.status}]`, response.data);
    return response;
  },
  (error) => {
    devLogger.log('error', 'API', `ERR: ${error.config?.method?.toUpperCase()} ${error.config?.url} [${error.response?.status}]`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
