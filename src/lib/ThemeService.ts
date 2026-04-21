import { CustomThemeColors, ThemeExport, ThemeType } from '../components/ThemeManager';

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  primary: '#6C63FF',
  primaryHover: '#5754D2',
  primaryForeground: '#FFFFFF',
  background: '#0f172a',
  foreground: '#f8fafc',
  card: '#1e293b',
  cardForeground: '#f1f5f9',
  muted: '#334155',
  mutedForeground: '#94a3b8',
  accent: '#374151',
  accentForeground: '#f9fafb',
  border: '#334155',
  input: '#334155'
};

// Convert hex color to RGB values as comma-separated string
const hexToRgb = (hex: string): string => {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Return RGB values as comma-separated string (for CSS variables)
  return `${r}, ${g}, ${b}`;
};

// Simple approach - use data attributes for theme switching
export const applyTheme = (theme: ThemeType, customColors?: CustomThemeColors): void => {
  if (typeof document === 'undefined') return;
  
  console.log('Applying theme:', theme);

  // Set theme using data-theme attribute
  document.documentElement.setAttribute('data-theme', theme);
  
  // Only set custom colors when using custom theme
  if (theme === 'custom' && customColors) {
    applyCustomThemeColors(customColors);
  } else {
    // Reset custom theme colors when switching to a built-in theme
    resetCustomThemeColors();
  }

  // Store the theme preference in localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('silynkr-theme', theme);
    
    // Also store if dark mode is enabled for compatibility
    localStorage.setItem('silynkr-dark-mode', theme !== 'light' ? 'true' : 'false');
  }
};

// Function to apply custom theme colors directly to CSS variables
const applyCustomThemeColors = (colors: CustomThemeColors): void => {
  if (typeof document === 'undefined') return;

  // Apply custom colors directly to :root CSS variables
  document.documentElement.style.setProperty('--primary', hexToRgb(colors.primary));
  document.documentElement.style.setProperty('--primary-hover', hexToRgb(colors.primaryHover));
  document.documentElement.style.setProperty('--primary-foreground', hexToRgb(colors.primaryForeground));
  document.documentElement.style.setProperty('--background', hexToRgb(colors.background));
  document.documentElement.style.setProperty('--foreground', hexToRgb(colors.foreground));
  document.documentElement.style.setProperty('--card', hexToRgb(colors.card));
  document.documentElement.style.setProperty('--card-foreground', hexToRgb(colors.cardForeground));
  document.documentElement.style.setProperty('--muted', hexToRgb(colors.muted));
  document.documentElement.style.setProperty('--muted-foreground', hexToRgb(colors.mutedForeground));
  document.documentElement.style.setProperty('--accent', hexToRgb(colors.accent));
  document.documentElement.style.setProperty('--accent-foreground', hexToRgb(colors.accentForeground));
  document.documentElement.style.setProperty('--border', hexToRgb(colors.border));
  document.documentElement.style.setProperty('--input', hexToRgb(colors.input));

  // Store custom colors in localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('silynkr-custom-colors', JSON.stringify(colors));
  }
};

// New function to reset custom theme CSS variables
const resetCustomThemeColors = (): void => {
  if (typeof document === 'undefined') return;
  
  // Reset all custom theme CSS variables to remove them from the DOM
  document.documentElement.style.removeProperty('--primary');
  document.documentElement.style.removeProperty('--primary-hover');
  document.documentElement.style.removeProperty('--primary-foreground');
  document.documentElement.style.removeProperty('--background');
  document.documentElement.style.removeProperty('--foreground');
  document.documentElement.style.removeProperty('--card');
  document.documentElement.style.removeProperty('--card-foreground');
  document.documentElement.style.removeProperty('--muted');
  document.documentElement.style.removeProperty('--muted-foreground');
  document.documentElement.style.removeProperty('--accent');
  document.documentElement.style.removeProperty('--accent-foreground');
  document.documentElement.style.removeProperty('--border');
  document.documentElement.style.removeProperty('--input');
};

// Get stored theme preference from localStorage or default to light
export const getStoredTheme = (): ThemeType => {
  if (typeof localStorage !== 'undefined' && typeof window !== 'undefined') {
    const storedTheme = localStorage.getItem('silynkr-theme') as ThemeType | null;
    
    // If we have a stored theme, use that
    if (storedTheme) return storedTheme;
    
    // Otherwise, check system preference for dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  
  return 'light';
};

// Get custom theme colors from localStorage or default
export const getStoredCustomColors = (): CustomThemeColors => {
  if (typeof localStorage !== 'undefined') {
    try {
      const storedColors = localStorage.getItem('silynkr-custom-colors');
      if (storedColors) {
        return JSON.parse(storedColors) as CustomThemeColors;
      }
    } catch (e) {
      console.error('Error parsing stored custom colors:', e);
    }
  }
  
  return DEFAULT_CUSTOM_THEME;
};

// Clear any theme-related storage
export const resetTheme = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('silynkr-theme');
    localStorage.removeItem('silynkr-custom-colors');
    localStorage.removeItem('silynkr-dark-mode');
  }
  
  if (typeof document !== 'undefined') {
    // Remove data-theme attribute
    document.documentElement.removeAttribute('data-theme');
    
    // Reset any inline styles
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--primary-hover');
    document.documentElement.style.removeProperty('--primary-foreground');
    document.documentElement.style.removeProperty('--background');
    document.documentElement.style.removeProperty('--foreground');
    document.documentElement.style.removeProperty('--card');
    document.documentElement.style.removeProperty('--card-foreground');
    document.documentElement.style.removeProperty('--muted');
    document.documentElement.style.removeProperty('--muted-foreground');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-foreground');
    document.documentElement.style.removeProperty('--border');
    document.documentElement.style.removeProperty('--input');
  }
};

// Export theme to JSON file
export const exportTheme = (theme: ThemeType, customColors: CustomThemeColors): void => {
  const themeData: ThemeExport = {
    name: theme === 'custom' ? 'My Custom Theme' : theme.charAt(0).toUpperCase() + theme.slice(1),
    type: theme,
    colors: customColors,
    version: '1.0'
  };
  
  const dataStr = JSON.stringify(themeData, null, 2);
  const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
  
  const exportName = `silynkr-theme-${theme}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportName);
  linkElement.click();
};

// Import theme from JSON file
export const importTheme = async (file: File): Promise<ThemeExport | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        console.log('Imported theme content:', content);
        
        if (!content) {
          reject(new Error('Empty file content'));
          return;
        }
        
        const theme = JSON.parse(content) as ThemeExport;
        console.log('Parsed theme:', theme);
        
        // Validate theme structure thoroughly
        if (!theme) {
          reject(new Error('Could not parse theme data'));
          return;
        }
        
        if (!theme.colors) {
          reject(new Error('Theme colors not found'));
          return;
        }
        
        // Make sure all required color properties exist
        const requiredColors = [
          'primary', 
          'primaryHover', 
          'background', 
          'foreground', 
          'card'
        ];
        
        const missingColors = requiredColors.filter(key => !theme.colors[key]);
        if (missingColors.length > 0) {
          reject(new Error(`Missing required colors: ${missingColors.join(', ')}`));
          return;
        }
        
        // Fill in any missing optional colors with defaults
        const completeColors = {
          ...DEFAULT_CUSTOM_THEME,
          ...theme.colors
        };
        
        // Return validated theme
        resolve({
          name: theme.name || 'Imported Theme',
          type: theme.type || 'custom',
          colors: completeColors,
          version: theme.version || '1.0'
        });
      } catch (error) {
        console.error('Error parsing theme file:', error);
        reject(new Error(`Failed to parse theme file: ${error.message}`));
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      reject(new Error('Failed to read theme file'));
    };
    
    reader.readAsText(file);
  });
}; 