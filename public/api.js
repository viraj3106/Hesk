const API_BASE_URL = window.location.origin;

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

const API = {
  setSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  getSession() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    return token && userStr ? JSON.parse(userStr) : null;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setSession(data.token, data.user);
    return data;
  },

  async signup(name, email, password, role) {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role })
    });
    this.setSession(data.token, data.user);
    return data;
  },

  async createTicket(title, category, priority, description) {
    return request('/tickets', {
      method: 'POST',
      body: JSON.stringify({ title, category, priority, description })
    });
  },

  async getMyTickets() {
    return request('/tickets/my');
  },

  async getTicketDetails(id) {
    return request(`/tickets/${id}`);
  },

  async getTicket(id) {
    return this.getTicketDetails(id);
  },

  async postResponse(id, message) {
    return request(`/tickets/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  async respondToTicket(id, message) {
    return this.postResponse(id, message);
  },

  async updateStatus(id, status) {
    return request(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async updateTicketStatus(id, status) {
    return this.updateStatus(id, status);
  },

  async assignTicket(id, agent_id) {
    return request(`/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ agent_id })
    });
  },

  async reopenTicket(id) {
    return request(`/tickets/${id}/reopen`, {
      method: 'PATCH'
    });
  },

  async getAgentQueue(status = '', page = 1, limit = 20) {
    const query = new URLSearchParams({ page, limit });
    if (status) query.append('status', status);
    return request(`/tickets/queue?${query.toString()}`);
  },

  async getAdminTickets(status = '', priority = '', assignedAgentId = '', page = 1, limit = 20) {
    const query = new URLSearchParams({ page, limit });
    if (status) query.append('status', status);
    if (priority) query.append('priority', priority);
    if (assignedAgentId) query.append('assigned_agent_id', assignedAgentId);
    return request(`/admin/tickets?${query.toString()}`);
  },

  async getAdminAgents() {
    return request('/admin/agents');
  },

  async getAdminStats() {
    return request('/admin/stats');
  },

  async forgotPassword(email) {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async verifyOtp(email, otp) {
    return request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  async resetPassword(resetToken, newPassword) {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword })
    });
  }
};
