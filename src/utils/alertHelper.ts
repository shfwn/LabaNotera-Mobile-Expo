export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export type AlertType = 'success' | 'danger' | 'warning' | 'info' | 'question';

export interface AlertConfig {
  id: string;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
}

type AlertListener = (config: AlertConfig | null) => void;

const listeners = new Set<AlertListener>();

export function subscribeAlert(listener: AlertListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type?: AlertType
) {
  let alertType: AlertType = type || 'info';

  if (!type) {
    const lowerTitle = title.toLowerCase();
    const hasDestructiveBtn = buttons?.some((b) => b.style === 'destructive');

    if (
      hasDestructiveBtn ||
      lowerTitle.includes('hapus') ||
      lowerTitle.includes('gagal') ||
      lowerTitle.includes('habis') ||
      lowerTitle.includes('batal') ||
      lowerTitle.includes('error')
    ) {
      alertType = 'danger';
    } else if (
      lowerTitle.includes('berhasil') ||
      lowerTitle.includes('sukses') ||
      lowerTitle.includes('ditambah') ||
      lowerTitle.includes('disimpan') ||
      lowerTitle.includes('dicatat') ||
      lowerTitle.includes('lunas')
    ) {
      alertType = 'success';
    } else if (
      lowerTitle.includes('wajib') ||
      lowerTitle.includes('peringatan') ||
      lowerTitle.includes('tidak valid') ||
      lowerTitle.includes('batas') ||
      lowerTitle.includes('kurang') ||
      lowerTitle.includes('melebihi')
    ) {
      alertType = 'warning';
    } else if (
      lowerTitle.includes('konfirmasi') ||
      lowerTitle.includes('yakin') ||
      lowerTitle.includes('produk baru') ||
      (buttons && buttons.length > 1)
    ) {
      alertType = 'question';
    } else {
      alertType = 'info';
    }
  }

  const normalizedButtons: AlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [
          {
            text: 'OK',
            style: 'default',
          },
        ];

  const config: AlertConfig = {
    id: Date.now().toString(),
    title,
    message,
    buttons: normalizedButtons,
    type: alertType,
  };

  listeners.forEach((listener) => {
    try {
      listener(config);
    } catch (e) {
      console.error('Error invoking alert listener:', e);
    }
  });
}
