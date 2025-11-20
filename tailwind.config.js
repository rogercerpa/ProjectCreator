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
        // Primary brand colors (Acuity green/black/slate)
        primary: {
          50: '#f0f5f2',
          100: '#d9e7de',
          200: '#bfd6c8',
          300: '#91b69f',
          400: '#485865', // Slate accent
          500: '#007239', // Core brand green
          600: '#005a2d',
          700: '#003d1f',
          800: '#002414',
          900: '#000000', // Deep anchoring tone
        },
        secondary: {
          50: '#e6f5fa',
          100: '#c2eaf2',
          200: '#8fd8e7',
          300: '#0099d8', // Vibrant accent blue
          400: '#31b4cc',
          500: '#409f68', // Supporting green
          600: '#2f8052',
          700: '#004d32', // Deep secondary
          800: '#003726',
          900: '#002217',
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

