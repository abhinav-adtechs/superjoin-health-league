/**
 * Theme configuration for Office Health Tracker
 * Uses Superjoin orange as the primary brand color
 */

export const theme = {
  colors: {
    // Superjoin Orange (Primary Brand Color)
    primary: '#FF6B35',
    'primary-dark': '#E55A2B',
    'primary-light': '#FF8C5A',
    'primary-lighter': '#FFB38A',
    'primary-lightest': '#FFD9C7',
    
    // Accent colors
    accent: {
      orange: '#FF6B35',
      'orange-dark': '#E55A2B',
      'orange-light': '#FF8C5A',
      green: '#059669',
      'green-dim': '#047857',
      gold: '#d97706',
      'gold-dim': '#b45309',
      blue: '#2563eb',
      purple: '#7c3aed',
      red: '#dc2626',
    },
    
    // Surface colors
    surface: {
      '0': '#ffffff',
      '1': '#f8fafc',
      '2': '#f1f5f9',
      '3': '#e2e8f0',
      '4': '#cbd5e1',
    },
    
    // Text colors
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#64748b',
    },
  },
  
  // Button styles
  buttons: {
    primary: {
      background: '#FF6B35',
      hover: '#E55A2B',
      text: '#ffffff',
      shadow: 'rgba(255, 107, 53, 0.35)',
    },
  },
  
  // Border colors
  borders: {
    default: 'rgba(0, 0, 0, 0.1)',
    focus: 'rgba(255, 107, 53, 0.5)',
    focusRing: 'rgba(255, 107, 53, 0.12)',
  },
} as const;

// Export individual color values for easy access
export const colors = theme.colors;
export const primaryColor = theme.colors.primary;
