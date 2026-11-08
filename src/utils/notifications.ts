/**
 * System notification handling for desktop & mobile
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationStatus(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function sendTransferNotification(
  title: string,
  options: {
    body: string;
    icon?: string;
    tag?: string;
  }
) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag || 'aetherdrop-transfer',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto close after 6 seconds
    setTimeout(() => {
      notification.close();
    }, 6000);
  } catch (err) {
    console.warn('Could not display system notification:', err);
  }
}
