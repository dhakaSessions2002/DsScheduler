// API client that replaces Base44 SDK
// All API calls go through this client which handles auth tokens

const TOKEN_KEY = 'ds_token';

function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
}

async function fetchApi(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
    });

    const data = await res.json();

    if (!res.ok) {
        const error = new Error(data.error || 'Request failed');
        error.status = res.status;
        error.data = data;
        throw error;
    }

    return data;
}

// Auth API
export const authApi = {
    login: async (email, password, otp = undefined) => {
        const body = { email, password };
        if (otp) body.otp = otp;
        
        const data = await fetchApi('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (data.token) setToken(data.token);
        return data;
    },

    register: async (email, password, full_name) => {
        const data = await fetchApi('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, full_name }),
        });
        if (data.token) setToken(data.token);
        return data;
    },

    me: async () => {
        return fetchApi('/api/auth/me');
    },

    logout: async () => {
        try {
            await fetchApi('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            // Ignore errors
        }
        removeToken();
    },

    forgotPassword: async (email) => {
        return fetchApi('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    verifyResetToken: async ({ token, email, code }) => {
        const params = new URLSearchParams();
        if (token) params.set('token', token);
        if (email) params.set('email', email);
        if (code) params.set('code', code);
        return fetchApi(`/api/auth/reset-password?${params.toString()}`);
    },

    resetPassword: async (tokenOrPayload, newPassword) => {
        const payload =
            typeof tokenOrPayload === 'object' && tokenOrPayload !== null
                ? tokenOrPayload
                : { token: tokenOrPayload, newPassword };
        return fetchApi('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    getToken,
    setToken,
    removeToken,
};

// Studio API (all CRUD operations)
export const studioApi = {
    call: async (op, payload = {}) => {
        return fetchApi('/api/studio', {
            method: 'POST',
            body: JSON.stringify({ op, ...payload }),
        });
    },
};

// Access API
export const accessApi = {
    getStatus: async (body = {}) => {
        return fetchApi('/api/access', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },
};
