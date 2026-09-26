export const Colors = {
  // Kupa Brand Palette - Forest Emerald Green
  primary: '#236B43',
  primaryDark: '#1A5333',
  primaryLight: '#E8F5E9',
  primarySoft: '#F4F9F5',
  accent: '#2D8A56',
  
  // Dynamic opacity helper
  bgColor: (opacity: number = 1) => `rgba(35, 107, 67, ${opacity})`,

  // Secondary Accents & Warning
  secondary: '#D97706',
  secondaryLight: '#FEF3C7',
  
  // Status Colors
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  success: '#236B43',
  successLight: '#E8F5E9',
  
  // Surfaces & Text (Light Mode)
  background: '#F8FAF8',
  card: '#FFFFFF',
  text: '#1A202C',
  textSecondary: '#718096',
  textMuted: '#A0AEC0',
  border: '#E2E8F0',
  borderLight: '#EDF2F7',
  
  // Category Pill States
  categoryActive: '#236B43',
  categoryInactive: '#F0F4F1',
  categoryActiveText: '#FFFFFF',
  categoryInactiveText: '#718096',
  shadow: 'rgba(0, 0, 0, 0.08)',
};

export const Radius = {
  full: 9999,
  xl3: 28,
  xl2: 20,
  xl: 16,
  lg: 12,
  md: 8,
};

export const Shadows = {
  glow: (opacity: number = 0.2, color: string = 'rgba(35, 107, 67, 1)') => ({
    shadowColor: color.startsWith('#')
      ? color
      : `rgba(35, 107, 67, ${opacity})`,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: opacity,
    shadowRadius: 6,
    elevation: 4,
  }),
  card: {
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  soft: {
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
};

export const Fonts = {
  largeTitle: 24,
  title: 20,
  subtitle: 16,
  body: 14,
  caption: 12,
  weightBold: '700' as const,
  weightSemiBold: '600' as const,
  weightNormal: '400' as const,
};
