const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com'
    : 'http://localhost:4002';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
  details?: any;
  meta?: any;
}

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}/api${endpoint}`;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new ApiError(
        data.error || 'Request failed',
        response.status,
        data.code,
        data.details
      );
    }

    return data.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new ApiError('Invalid response from server');
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Network error'
    );
  }
}

// Games API
export const gamesAPI = {
  create: async (mode: 'local' | 'ai' | 'online') => {
    return apiRequest('/games', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },

  get: async (id: string) => {
    return apiRequest(`/games/${id}`, {
      method: 'GET',
    });
  },

  update: async (id: string, updates: any) => {
    return apiRequest(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  delete: async (id: string) => {
    return apiRequest(`/games/${id}`, {
      method: 'DELETE',
    });
  },

  makeMove: async (
    gameId: string,
    column: number,
    player: 'red' | 'yellow',
    row: number
  ) => {
    return apiRequest(`/games/${gameId}/moves`, {
      method: 'POST',
      body: JSON.stringify({ column, player, row }),
    });
  },

  getAIMove: async (gameId: string) => {
    return apiRequest(`/games/${gameId}/ai-move`, {
      method: 'POST',
    });
  },

  list: async (filters?: { mode?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.mode) params.append('mode', filters.mode);
    if (filters?.status) params.append('status', filters.status);

    const query = params.toString();
    return apiRequest(`/games${query ? `?${query}` : ''}`);
  },
};

// Rooms API
export const roomsAPI = {
  create: async (players?: string[]) => {
    return apiRequest('/rooms', {
      method: 'POST',
      body: JSON.stringify({ players }),
    });
  },

  get: async (code: string) => {
    return apiRequest(`/rooms/${code}`, {
      method: 'GET',
    });
  },

  update: async (code: string, updates: any) => {
    return apiRequest(`/rooms/${code}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  join: async (code: string, playerName: string) => {
    return apiRequest(`/rooms/${code}`, {
      method: 'POST',
      body: JSON.stringify({ playerName }),
    });
  },

  list: async () => {
    return apiRequest('/rooms');
  },
};

// Stats API
export const statsAPI = {
  get: async () => {
    return apiRequest('/stats');
  },
};

// Admin API
export const adminAPI = {
  cleanup: async () => {
    return apiRequest('/admin/cleanup', {
      method: 'POST',
    });
  },
};

export { ApiError };
