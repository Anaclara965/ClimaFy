import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('climafy_token') ?? localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('climafy_token');
      localStorage.removeItem('token');
      window.location.assign('/login');
    }

    return Promise.reject(error);
  },
);

export const unwrap = (response) => response.data?.data ?? response.data;

export const authAPI = {
  login: (payload) => api.post('/api/auth/login', payload),
  register: (payload) => api.post('/api/auth/register', payload),
  verify: (payload) => api.post('/api/auth/verify', payload),
  me: () => api.get('/api/auth/me'),
};

export const reportsAPI = {
  list: (params = {}) => api.get('/api/reports', { params }),
  create: (payload) => api.post('/api/reports', payload, {
    headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  }),
  updateStatus: (id, status) => api.patch(`/api/reports/${id}/status`, { status }),
  getById: (id) => api.get(`/api/reports/${id}`),
};

export const neighborhoodsAPI = {
  list: (params = {}) => api.get('/api/neighborhoods', { params }),
  getById: (id) => api.get(`/api/neighborhoods/${id}`),
  mapData: (params = {}) => api.get('/api/map/data', { params }),
};

export const rankingAPI = {
  list: (params = {}) => api.get('/api/ranking', { params }),
  investments: (params = {}) => api.get('/api/ranking/investments', { params }),
};

export const investmentsAPI = {
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/api/investments/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
