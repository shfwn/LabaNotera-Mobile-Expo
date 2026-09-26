import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { AlertConfig, AlertButton, AlertType, subscribeAlert } from '../utils/alertHelper';

export default function CustomAlertModal() {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = subscribeAlert((newConfig) => {
      setConfig(newConfig);
      if (newConfig) {
        scaleAnim.setValue(0.85);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleClose = (button?: AlertButton) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setConfig(null);
      if (button?.onPress) {
        button.onPress();
      }
    });
  };

  if (!config) return null;

  const { title, message, buttons = [{ text: 'OK', style: 'default' }], type = 'info' } = config;

  const getIconInfo = (alertType: AlertType) => {
    switch (alertType) {
      case 'success':
        return {
          name: 'checkmark-circle' as const,
          color: Colors.success,
          bgColor: Colors.successLight,
        };
      case 'danger':
        return {
          name: 'close-circle' as const,
          color: Colors.danger,
          bgColor: Colors.dangerLight,
        };
      case 'warning':
        return {
          name: 'warning' as const,
          color: Colors.warning,
          bgColor: Colors.warningLight,
        };
      case 'question':
        return {
          name: 'help-circle' as const,
          color: Colors.primary,
          bgColor: Colors.primaryLight,
        };
      case 'info':
      default:
        return {
          name: 'information-circle' as const,
          color: Colors.primary,
          bgColor: Colors.primaryLight,
        };
    }
  };

  const iconInfo = getIconInfo(type);
  const isTwoButtons = buttons.length === 2;

  return (
    <Modal
      transparent
      visible={!!config}
      animationType="none"
      onRequestClose={() => {
        const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
        handleClose(cancelBtn);
      }}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Icon Badge */}
          <View style={[styles.iconContainer, { backgroundColor: iconInfo.bgColor }]}>
            <Ionicons name={iconInfo.name} size={42} color={iconInfo.color} />
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View style={[styles.buttonGroup, isTwoButtons && styles.buttonGroupRow]}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnStyle: object = styles.defaultBtn;
              let textStyle: object = styles.defaultBtnText;

              if (isCancel) {
                btnStyle = styles.cancelBtn;
                textStyle = styles.cancelBtnText;
              } else if (isDestructive) {
                btnStyle = styles.destructiveBtn;
                textStyle = styles.destructiveBtnText;
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.baseBtn, btnStyle, isTwoButtons && styles.flexBtn]}
                  activeOpacity={0.75}
                  onPress={() => handleClose(btn)}
                >
                  <Text style={[styles.baseBtnText, textStyle]}>{btn.text || 'OK'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    width: Math.min(width - 40, 380),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 22,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  buttonGroupRow: {
    flexDirection: 'row',
  },
  flexBtn: {
    flex: 1,
  },
  baseBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  defaultBtn: {
    backgroundColor: Colors.primary,
  },
  defaultBtnText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
  },
  destructiveBtn: {
    backgroundColor: Colors.danger,
  },
  destructiveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
  },
  cancelBtn: {
    backgroundColor: '#F1F5F2',
    borderWidth: 1,
    borderColor: '#E5E9E6',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '700' as const,
  },
});
