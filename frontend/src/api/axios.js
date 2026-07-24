import axios from 'axios';

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
  return config;
});

export default api;
