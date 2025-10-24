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
          500: '#48bb78',
          600: '#38a169',
          700: '#2f855a',
        },
        warning: {
          50: '#fef3c7',
          100: '#fde68a',
          500: '#ed8936',
          600: '#dd6b20',
          700: '#c05621',
        },
        error: {
          50: '#fee2e2',
          100: '#fecaca',
          500: '#f56565',
          600: '#e53e3e',
          700: '#c53030',
        },
        info: {
          50: '#dbeafe',
          100: '#bfdbfe',
          500: '#4299e1',
          600: '#3182ce',
          700: '#2c5282',
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
        'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
      },
    },
  },
  plugins: [],
}

