import axios from "axios";

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// Send CSRF token on every mutating request
api.interceptors.request.use((config) => {
  const csrf = getCsrfToken();
  if (csrf) config.headers["X-CSRFToken"] = csrf;
  return config;
});

// Only redirect to login on true 401 — let components handle 403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;
