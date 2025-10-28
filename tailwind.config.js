/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Primary brand colors from existing design
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b8c9ff',
          400: '#93a8ff',
          500: '#667eea', // Main primary color
          600: '#5a67d8',
          700: '#4c51bf',
          800: '#434190',
          900: '#3c366b',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#764ba2', // Main secondary color
          600: '#6b46c1',
          700: '#5a3a9a',
          800: '#4c3273',
          900: '#3f2a5f',
        },
        // Semantic colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#48bb78',
          600: '#38a169',
          700: '#2f855a',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fef3c7',
          100: '#fde68a',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ed8936',
          600: '#dd6b20',
          700: '#c05621',
          800: '#9a3412',
          900: '#7c2d12',
        },
        error: {
          50: '#fee2e2',
          100: '#fecaca',
          200: '#fca5a5',
          300: '#f87171',
          400: '#ef4444',
          500: '#f56565',
          600: '#e53e3e',
          700: '#c53030',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50: '#dbeafe',
          100: '#bfdbfe',
          200: '#93c5fd',
          300: '#60a5fa',
          400: '#3b82f6',
          500: '#4299e1',
          600: '#3182ce',
          700: '#2c5282',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Extended colors for gradients
        green: {
          600: '#16a34a',
        },
        orange: {
          600: '#ea580c',
        },
        red: {
          600: '#dc2626',
        },
        blue: {
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0,0,0,0.05)',
        'medium': '0 4px 12px rgba(0,0,0,0.1)',
        'large': '0 8px 24px rgba(0,0,0,0.15)',
        'primary': '0 4px 12px rgba(102, 126, 234, 0.3)',
        'secondary': '0 4px 12px rgba(118, 75, 162, 0.3)',
      },
      borderRadius: {
        'soft': '8px',
        'medium': '12px',
        'large': '16px',
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in',
        'slideIn': 'slideIn 0.3s ease-out',
        'slideUp': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}

