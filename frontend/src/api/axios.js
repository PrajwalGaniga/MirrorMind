import axios from 'axios';
import { devLogger } from '../utils/logger';

const USE_NGROK = false; // Set to false to use localhost

const LOCAL_URL = 'http://localhost:8000';
const NGROK_URL = 'https://dawdlingly-pseudoinsane-pa.ngrok-free.dev';

const api = axios.create({
  baseURL: USE_NGROK ? NGROK_URL : LOCAL_URL,
  headers: {
    // Add header to skip ngrok's browser warning page
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
