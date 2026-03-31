export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface NotificationAction {
  label?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  variant?: 'default' | 'order';
  title?: string;
  message: string;
  caption?: string;
  badge?: string;
  iconClass?: string;
  action?: NotificationAction;
  duration?: number;
  timestamp?: number;
}
