import apiClient from './client';

export interface AppNotification {
  _id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export const getNotifications = (page: number = 1) =>
  apiClient
    .get<{ success: boolean; data: AppNotification[]; pagination: { page: number; pages: number } }>(
      '/notifications',
      { params: { page } }
    )
    .then((r) => r.data);

export const getUnreadCount = () =>
  apiClient.get<{ success: boolean; count: number }>('/notifications/unread-count').then((r) => r.data.count);

export const markNotificationAsRead = (id: string) =>
  apiClient.patch<{ success: boolean; data: AppNotification }>(`/notifications/${id}/read`).then((r) => r.data);

export const markAllNotificationsAsRead = () =>
  apiClient.patch<{ success: boolean }>('/notifications/read-all').then((r) => r.data);
