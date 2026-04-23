import axios from 'axios';
import type { Task, SubTask, Activity } from '../types';

const API_BASE = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const taskApi = {
  getAll: async () => {
    const { data } = await api.get<{ tasks: Task[] }>('/tasks');
    return data.tasks;
  },
  
  getByStatus: async (status: string) => {
    const { data } = await api.get<{ tasks: Task[] }>(`/tasks/status/${status}`);
    return data.tasks;
  },
  
  getById: async (id: number) => {
    const { data } = await api.get<{ task: Task; subtasks: SubTask[]; activities: Activity[] }>(`/tasks/${id}`);
    return data;
  },
  
  create: async (task: {
    title: string;
    description?: string;
    status?: string;
    parentId?: number | null;
    color?: string;
    tags?: string[];
    estimatedTime?: string;
    subtasks?: { title: string }[];
  }) => {
    const { data } = await api.post('/tasks', task);
    return data;
  },
  
  updateStatus: async (id: number, status: string) => {
    const { data } = await api.patch(`/tasks/${id}`, { status });
    return data;
  },
  
  moveTask: async (id: number, status: string) => {
    const { data } = await api.post(`/tasks/${id}/move`, { status });
    return data;
  },
  
  delete: async (id: number) => {
    const { data } = await api.delete(`/tasks/${id}`);
    return data;
  },
};

export const subtaskApi = {
  create: async (taskId: number, title: string, order?: number) => {
    const { data } = await api.post(`/tasks/${taskId}/subtasks`, { title, order });
    return data;
  },
  
  toggle: async (taskId: number, subtaskId: number) => {
    const { data } = await api.post(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`);
    return data;
  },
};

export const activityApi = {
  getByTaskId: async (taskId: number) => {
    const { data } = await api.get<{ activities: Activity[] }>(`/tasks/${taskId}/activities`);
    return data.activities;
  },
  
  create: async (taskId: number, type: string, content: string) => {
    const { data } = await api.post(`/tasks/${taskId}/activities`, { type, content });
    return data;
  },
};

export const agentApi = {
  analyze: async (message: string) => {
    const { data } = await api.post('/agent/analyze', { message });
    return data;
  },
  
  execute: async (taskId: number, context?: string) => {
    const { data } = await api.post('/agent/execute', { taskId, context });
    return data;
  },
};

export default api;
