/* ================================================
   api.js — All API Calls + Error Handling
   ================================================ */

export const API = {

  // ── Core request method ──
  async _request(method, endpoint, body = null) {
    const token = await Auth.getToken();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res  = await fetch(`${CONFIG.API_BASE}${endpoint}`, options);
    const data = await res.json();

    if (!data.success) {
      const err     = new Error(data.message || 'Request failed');
      err.status    = res.status;
      err.errors    = data.errors || [];
      err.response  = data;
      throw err;
    }

    return data;
  },

  get:    (endpoint)        => API._request('GET',    endpoint),
  post:   (endpoint, body)  => API._request('POST',   endpoint, body),
  patch:  (endpoint, body)  => API._request('PATCH',  endpoint, body),
  delete: (endpoint)        => API._request('DELETE', endpoint),

  // ════════════════════════════
  // AUTH
  // ════════════════════════════
  auth: {
    getProfile:    ()     => API.get('/auth/profile'),
    updateProfile: (data) => API.patch('/auth/profile', data),
    deleteAccount: ()     => API.delete('/auth/account'),
  },

  // ════════════════════════════
  // TASKS
  // ════════════════════════════
  tasks: {
    getAll:          ()       => API.get('/tasks'),
    getById:         (id)     => API.get(`/tasks/${id}`),
    complete:        (id, data) => API.post(`/tasks/${id}/complete`, data),
    getCompletions:  (page=1) => API.get(`/tasks/my-completions?page=${page}`),
  },

  // ════════════════════════════
  // WALLET
  // ════════════════════════════
  wallet: {
    get:             ()          => API.get('/wallet'),
    getStats:        ()          => API.get('/wallet/stats'),
    getTransactions: (page=1, type='') =>
      API.get(`/wallet/transactions?page=${page}&type=${type}`),
  },

  // ════════════════════════════
  // WITHDRAWALS
  // ════════════════════════════
  withdraw: {
    getAll:    (page=1, status='') =>
      API.get(`/withdraw?page=${page}&status=${status}`),
    request:   (data) => API.post('/withdraw', data),
    cancel:    (id)   => API.patch(`/withdraw/${id}/cancel`),
  },

  // ════════════════════════════
  // CAMPAIGNS
  // ════════════════════════════
  campaigns: {
    getAll:    (page=1, status='') =>
      API.get(`/campaigns?page=${page}&status=${status}`),
    getById:   (id)   => API.get(`/campaigns/${id}`),
    getStats:  (id)   => API.get(`/campaigns/${id}/stats`),
    create:    (data) => API.post('/campaigns', data),
    update:    (id, data) => API.patch(`/campaigns/${id}`, data),
    delete:    (id)   => API.delete(`/campaigns/${id}`),
  },

  // ════════════════════════════
  // ADMIN
  // ════════════════════════════
  admin: {
    getStats:     ()             => API.get('/admin/stats'),
    getUsers:     (page=1, q='') =>
      API.get(`/admin/users?page=${page}&search=${q}`),
    banUser:      (id, reason)   => API.patch(`/admin/users/${id}/ban`,   { reason }),
    unbanUser:    (id)           => API.patch(`/admin/users/${id}/unban`),
    getCampaigns: (page=1, status='') =>
      API.get(`/admin/campaigns?page=${page}&status=${status}`),
    approveCampaign: (id)        => API.patch(`/admin/campaigns/${id}/approve`),
    rejectCampaign:  (id, reason)=> API.patch(`/admin/campaigns/${id}/reject`, { reason }),
    getWithdrawals:  (page=1, status='pending') =>
      API.get(`/admin/withdrawals?page=${page}&status=${status}`),
    processWithdrawal: (id, action, note) =>
      API.patch(`/admin/withdrawals/${id}/process`, { action, note }),
    getFraudFlags: (page=1) =>
      API.get(`/admin/fraud-flags?page=${page}&resolved=false`),
    resolveFlag:   (id) => API.patch(`/admin/fraud-flags/${id}/resolve`),
  },
};
