// API service for communicating with the backend database
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🔄 API Request (attempt ${attempt}): ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.statusText = response.statusText;
          console.error(`❌ API Error: ${error.message}`);
          throw error;
        }

        const data = await response.json();
        console.log(`✅ API Success: ${options.method || 'GET'} ${url}`);
        return data;
      } catch (error) {
        lastError = error;
        console.error(`❌ API Request failed (attempt ${attempt}):`, error.message);
        
        // Don't retry on client errors (4xx) or if it's the last attempt
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  // Data operations
  async getAllData() {
    return this.request('/data');
  }

  // Booking operations
  async getBookings() {
    return this.request('/bookings');
  }

  async getBooking(id) {
    return this.request(`/bookings/${id}`);
  }

  async createBooking(booking) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking)
    });
  }

  async updateBooking(id, booking) {
    return this.request(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(booking)
    });
  }

  async deleteBooking(id) {
    return this.request(`/bookings/${id}`, {
      method: 'DELETE'
    });
  }

  // Client operations
  async getClients() {
    return this.request('/clients');
  }

  async createClient(client) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(client)
    });
  }

  // Room operations
  async getRooms() {
    return this.request('/rooms');
  }

  async createRoom(room) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify(room)
    });
  }

  async updateRoomsOrder(rooms) {
    return this.request('/rooms/order', {
      method: 'PUT',
      body: JSON.stringify({ rooms })
    });
  }

  // Payment Methods operations
  async getPaymentMethods() {
    return this.request('/payment-methods');
  }

  async getPaymentMethod(id) {
    return this.request(`/payment-methods/${id}`);
  }

  async createPaymentMethod(paymentMethod) {
    return this.request('/payment-methods', {
      method: 'POST',
      body: JSON.stringify(paymentMethod)
    });
  }

  async updatePaymentMethod(id, paymentMethod) {
    return this.request(`/payment-methods/${id}`, {
      method: 'PUT',
      body: JSON.stringify(paymentMethod)
    });
  }

  async deletePaymentMethod(id) {
    return this.request(`/payment-methods/${id}`, {
      method: 'DELETE'
    });
  }

  // Payment operations
  async getPayments(filters = {}) {
    const queryParams = new URLSearchParams(filters);
    return this.request(`/payments?${queryParams}`);
  }

  async getPaymentsByBooking(bookingId) {
    return this.request(`/payments/booking/${bookingId}`);
  }

  async createPayment(payment) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(payment)
    });
  }

  async getPaymentStats(filters = {}) {
    const queryParams = new URLSearchParams(filters);
    return this.request(`/payments/stats?${queryParams}`);
  }

  // Export operations
  async exportData() {
    return this.request('/export');
  }

  async importData(data) {
    return this.request('/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createBackup() {
    return this.request('/backup', {
      method: 'POST',
    });
  }

  // Utility methods
  isNetworkError(error) {
    return !error.status || error.status >= 500 || error.message.includes('Failed to fetch');
  }

  getErrorMessage(error) {
    if (this.isNetworkError(error)) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (error.status === 404) {
      return 'The requested resource was not found.';
    }
    
    if (error.status === 500) {
      return 'Server error. Please try again later.';
    }
    
    return error.message || 'An unexpected error occurred.';
  }
}

// Create a singleton instance
const apiService = new ApiService();
export default apiService;