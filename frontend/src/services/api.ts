const API_BASE = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Always send cookies
    });

    if (response.status === 401) {
      return { error: 'Unauthorized' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.detail || 'An error occurred' };
    }

    if (response.status === 204) {
      return { data: undefined as T };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Network error' };
  }
}

// Auth - FastAPI-Users uses form-urlencoded for login
export const login = async (email: string, password: string): Promise<ApiResponse<User>> => {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: email,  // FastAPI-Users expects 'username' field
        password: password,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.detail || 'Login fehlgeschlagen' };
    }

    // After login, fetch user data
    return getMe();
  } catch (error) {
    return { error: 'Network error' };
  }
};

export const register = (email: string, password: string) =>
  apiRequest<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const logout = () =>
  apiRequest<void>('/auth/logout', { method: 'POST' });

export const getMe = () => apiRequest<User>('/auth/me');

export const checkRegistrationEnabled = () => 
  apiRequest<{ enabled: boolean }>('/auth/registration-enabled');

export const getSettings = () => apiRequest<UserSettings>('/auth/me/settings');

export const updateSettings = (settings: Partial<UserSettings>) =>
  apiRequest<UserSettings>('/auth/me/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

// Admin Settings (App Configuration)
export const getAppSettings = () => apiRequest<AppSettings>('/admin/settings');

export const updateAppSettings = (settings: Partial<AppSettingsUpdate>) =>
  apiRequest<AppSettings>('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

export const testSmtp = (email: string) =>
  apiRequest<{ message: string }>('/admin/settings/test-smtp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const clearHistory = () =>
  apiRequest<void>('/devices', { method: 'DELETE' });

// Devices
export const getDevices = (activeOnly = false) =>
  apiRequest<Device[]>(`/devices?active_only=${activeOnly}`);

export const createDevice = (device: CreateDeviceRequest) =>
  apiRequest<Device>('/devices', {
    method: 'POST',
    body: JSON.stringify(device),
  });

export const endDevice = (id: number) =>
  apiRequest<Device>(`/devices/${id}/end`, { method: 'PUT' });

export const reportFailure = (id: number, reason: string, notes?: string, failedAt?: string) =>
  apiRequest<Device>(`/devices/${id}/failure`, {
    method: 'POST',
    body: JSON.stringify({ reason, notes, failed_at: failedAt }),
  });

export const updateDevice = (id: number, data: { start_time?: string }) =>
  apiRequest<Device>(`/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteDevice = (id: number) =>
  apiRequest<void>(`/devices/${id}`, { method: 'DELETE' });

// Stats
export const getOverviewStats = () => apiRequest<OverviewStats>('/stats/overview');

export const getFailureStats = () => apiRequest<FailureStats>('/stats/failures');

export const getHistory = (days = 90) =>
  apiRequest<HistoryEntry[]>(`/stats/history?days=${days}`);

// Enums
export const getBodyLocations = () =>
  apiRequest<EnumOption[]>('/enums/body-locations');

export const getFailureReasons = () =>
  apiRequest<EnumOption[]>('/enums/failure-reasons');

export const getDeviceTypes = () =>
  apiRequest<EnumOption[]>('/enums/device-types');

// Types
export interface User {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  settings: UserSettings;
  created_at: string | null;
}

export interface UserSettings {
  sensor_default_hours: number;
  catheter_default_hours: number;
  reminder_intervals_hours: number[];
}

export interface Device {
  id: number;
  device_type: 'sensor' | 'catheter';
  body_location: string;
  body_location_label: string;
  start_time: string;
  planned_duration_hours: number;
  status: 'active' | 'completed' | 'failed';
  ended_at: string | null;
  created_at: string;
  remaining_hours: number | null;
  progress_percent: number | null;
  failure_reason: string | null;
  failure_notes: string | null;
}

export interface CreateDeviceRequest {
  device_type: 'sensor' | 'catheter';
  body_location: string;
  start_time?: string;
  planned_duration_hours?: number;
}

export interface OverviewStats {
  total_devices: number;
  active_devices: number;
  completed_devices: number;
  failed_devices: number;
  sensor_failure_rate: number;
  catheter_failure_rate: number;
  avg_sensor_duration_hours: number | null;
  avg_catheter_duration_hours: number | null;
}

export interface FailureStats {
  by_reason: FailureByReason[];
  by_location: FailureByLocation[];
  by_device_type: MTBFStats[];
}

export interface FailureByReason {
  reason: string;
  reason_label: string;
  count: number;
  percentage: number;
}

export interface FailureByLocation {
  body_location: string;
  body_location_label: string;
  total_devices: number;
  failed_devices: number;
  failure_rate: number;
}

export interface MTBFStats {
  device_type: string;
  mtbf_hours: number | null;
  total_failures: number;
  total_completed: number;
}

export interface HistoryEntry {
  id: number;
  device_type: string;
  body_location: string;
  body_location_label: string;
  start_time: string;
  ended_at: string | null;
  planned_duration_hours: number;
  actual_duration_hours: number | null;
  status: string;
  failure_reason: string | null;
}

export interface EnumOption {
  value: string;
  label: string;
}

export interface AppSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from: string;
  smtp_tls: boolean;
  app_url: string;
}

export interface AppSettingsUpdate {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from?: string;
  smtp_tls?: boolean;
  app_url?: string;
}
