import axios, { isAxiosError, type AxiosInstance } from 'axios';

const api = axios.create({ baseURL: "/api" });

export default api;

export function inviteApi(token: string): AxiosInstance {
  return axios.create({
    baseURL: "/api",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const body = error.response?.data;

    if (typeof body === "string" && body.trim())
      return body;
  }

  return fallback;
}
