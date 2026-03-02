import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('civiflow_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('civiflow_token');
            localStorage.removeItem('civiflow_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// Auth
export const login = (data: { email: string; password: string }) => api.post('/auth/login', data);
export const register = (data: object) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

// Issues
export const getIssues = (params?: {
    status?: string; category?: string; search?: string;
    sla_breached?: boolean | string; ward_id?: number |
    string;
    page?: number; limit?: number;
}) => api.get('/issues', { params });

export const getIssue = (id: number) => api.get(`/issues/${id}`);
export const createIssue = (data: FormData) => api.post('/issues', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateStatus = (id: number, status: string, note?: string) => api.patch(`/issues/${id}/status`, { status, note });
export const verifyResolution = (id: number, accepted: boolean, reason?: string) => api.post(`/issues/${id}/verify`, { accepted, reason });
export const uploadMedia = (id: number, data: FormData) => api.post(`/issues/${id}/media`, data, { headers: { 'Content-Type': 'multipart/form-data' } });

// Assignments
export const getMyAssignments = () => api.get('/assignments/mine');
export const getWorkers = (wardId?: number) => api.get('/assignments/workers', { params: wardId ? { wardId } : {} });
export const reassign = (issueId: number, workerId: number, reason: string) =>
    api.patch(`/assignments/issues/${issueId}/reassign`, { workerId, reason });

// Analytics
export const getOverview = () => api.get('/analytics/overview');
export const getWardStats = () => api.get('/analytics/ward');
export const getSLAMetrics = () => api.get('/analytics/sla');
export const getHeatmap = () => api.get('/analytics/heatmap');
export const getDeptPerformance = () => api.get('/analytics/departments');
export const getEscalations = () => api.get('/analytics/escalations');

// Admin
export const toggleIncidentMode = (activate: boolean, reason?: string) =>
    api.post('/admin/incident-mode', { activate, reason });
export const getIncidentMode = () => api.get('/admin/incident-mode');
export const getAllUsers = (role?: string) => api.get('/admin/users', { params: role ? { role } : {} });
export const getDepartments = () => api.get('/wards/departments');
export const getWards = () => api.get('/wards');
export const getNearestWard = (lat: number, lng: number) =>
    api.get('/wards/nearest', { params: { lat, lng } });

export default api;
