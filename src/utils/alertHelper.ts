import { Alert, Platform } from 'react-native';

interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export function showAppAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS === 'web') {
    if (!buttons || buttons.length <= 1) {
      window.alert(`${title}${message ? '\n\n' + message : ''}`);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const confirmed = window.confirm(`${title}${message ? '\n\n' + message : ''}`);
      if (confirmed) {
        if (confirmBtn?.onPress) confirmBtn.onPress();
      } else {
        if (cancelBtn?.onPress) cancelBtn.onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
