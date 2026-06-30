import axios from 'axios';
import type { PaginatedCompounds, StatsResponse, CompoundFilters, Compound } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export async function getCompounds(filters: CompoundFilters = {}): Promise<PaginatedCompounds> {
  const { data } = await api.get<PaginatedCompounds>('/compounds', { params: filters });
  return data;
}

export async function getCompound(id: number): Promise<Compound> {
  const { data } = await api.get<Compound>(`/compounds/${id}`);
  return data;
}

export async function getStats(): Promise<StatsResponse> {
  const { data } = await api.get<StatsResponse>('/compounds/stats');
  return data;
}

export async function getCategories(): Promise<string[]> {
  const { data } = await api.get<string[]>('/compounds/categories/list');
  return data;
}

export default api;
