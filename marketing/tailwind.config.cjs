/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(214, 32%, 91%)',
        input: 'hsl(214, 32%, 91%)',
        ring: 'hsl(217, 91%, 60%)',
        background: 'hsl(0, 0%, 100%)',
        foreground: 'hsl(222, 47%, 11%)',
        primary: {
          DEFAULT: 'hsl(217, 91%, 60%)',
          foreground: 'hsl(0, 0%, 100%)',
          50: 'hsl(217, 91%, 97%)',
          100: 'hsl(217, 91%, 93%)',
          200: 'hsl(217, 91%, 85%)',
          300: 'hsl(217, 91%, 75%)',
          400: 'hsl(217, 91%, 67%)',
          500: 'hsl(217, 91%, 60%)',
          600: 'hsl(217, 91%, 50%)',
          700: 'hsl(217, 91%, 40%)',
          800: 'hsl(217, 91%, 30%)',
          900: 'hsl(217, 91%, 20%)',
        },
        secondary: {
          DEFAULT: 'hsl(214, 32%, 91%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
        destructive: {
          DEFAULT: 'hsl(0, 84%, 60%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
        success: {
          DEFAULT: 'hsl(142, 76%, 36%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
        warning: {
          DEFAULT: 'hsl(38, 92%, 50%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
        info: {
          DEFAULT: 'hsl(217, 91%, 60%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
        muted: {
          DEFAULT: 'hsl(210, 40%, 96%)',
          foreground: 'hsl(215, 16%, 47%)',
        },
        accent: {
          DEFAULT: 'hsl(210, 40%, 96%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
        card: {
          DEFAULT: 'hsl(0, 0%, 100%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.5s ease-out forwards',
        'count-up': 'count-up 0.4s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};
