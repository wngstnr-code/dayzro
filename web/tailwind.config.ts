import daisyuiPlugin from 'daisyui';
import type { Config } from 'tailwindcss';


const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/dapp/**/*.{ts,tsx}', './src/app/(app)/**/*.{ts,tsx}'],
  theme: {
    extend: {
      width: {
        dvw: '100dvw',
      },
      colors: {
        /***************
         * Base colors *
         ***************/

        blue: {
          0: '#FFFFFF',
          5: '#F3F8FF',
          10: '#E7F1FF',
          50: '#C1DFFF',
          100: '#8DC4FF',
          200: '#5AAAFF',
          300: '#2C8FFF',
          400: '#006AFF',
          500: '#0052CC',
          600: '#003E99',
          700: '#002966',
          800: '#001833',
          900: '#000C0D',
          1000: '#0B0706',
        },

        grey: {
          0: '#FFFFFF',
          5: '#FFFAF6',
          10: '#F6F1EE',
          50: '#E9E1DC',
          100: '#D2C6C0',
          200: '#BFA99F',
          300: '#9C8880',
          400: '#806C64',
          500: '#6E5A52',
          600: '#45342D',
          700: '#2E211C',
          800: '#221713',
          900: '#140C0A',
          1000: '#0B0706',
        },

        /* Dayzro sunrise accents */
        sunrise: {
          DEFAULT: '#FF8A3D',
          dark: '#FF7A3D',
          ember: '#C2410C',
          magenta: '#D1127A',
          deep: '#B0126A',
        },

        pink: {
          0: '#FFFFFF',
          5: '#FFFAF6',
          10: '#FFEBDD',
          50: '#FFD3B5',
          100: '#FFB27F',
          200: '#FF9F5E',
          300: '#FF8A3D',
          400: '#E2541B',
          500: '#C2410C',
          600: '#9A3410',
          700: '#7A2A0E',
          800: '#44180A',
          900: '#221713',
          1000: '#0B0706',
        },

        red: {
          0: '#FFFFFF',
          5: '#FEF5F5',
          10: '#FFE7E7',
          50: '#FFC5C5',
          100: '#FF9B9C',
          200: '#FD7576',
          300: '#F15C5D',
          400: '#DB4546',
          500: '#CE2C2D',
          600: '#BB1A1B',
          700: '#790102',
          800: '#440000',
          900: '#250000',
          1000: '#0B0706',
        },

        green: {
          0: '#FFFFFF',
          5: '#F2FFFA',
          10: '#E4FFF4',
          50: '#BFFFE4',
          100: '#89FFCD',
          200: '#65F0B6',
          300: '#47E0A0',
          400: '#2DCA88',
          500: '#19BA76',
          600: '#059458',
          700: '#005E36',
          800: '#00321D',
          900: '#001C10',
          1000: '#0B0706',
        },

        yellow: {
          0: '#FFFFFF',
          5: '#FFFCF3',
          10: '#FFF6DE',
          50: '#FFEAB5',
          100: '#FFDC85',
          200: '#FFCF55',
          300: '#F8C23B',
          400: '#EBB222',
          500: '#DBA00D',
          600: '#C28B00',
          700: '#775602',
          800: '#382800',
          900: '#201700',
          1000: '#0B0706',
        },

        /*******************
         * Semantic colors *
         *******************/

        primary: {
          DEFAULT: 'var(--primary-brand)',
          brand: 'var(--primary-brand)',
          content: 'var(--primary-content)',
          link: {
            DEFAULT: 'var(--primary-link)',
            hover: 'var(--primary-link-hover)',
          },
          icon: 'var(--primary-icon)',
          background: 'var(--primary-background)',

          interactive: {
            DEFAULT: 'var(--primary-interactive)',
            accent: 'var(--primary-interactive-accent)',
            hover: 'var(--primary-interactive-hover)',
          },
          border: {
            DEFAULT: 'var(--primary-border)',
            dark: 'var(--primary-border-dark)',
            hover: 'var(--primary-border-hover)',
            accent: 'var(--primary-border-accent)',
          },

          base: {
            content: 'var(--primary-base-content)',
            background: 'var(--primary-base-background)',
          },
        },

        secondary: {
          DEFAULT: 'var(--secondary-brand)',
          brand: 'var(--secondary-brand)',
          content: 'var(--secondary-content)',
          icon: 'var(--secondary-icon)',
          interactive: {
            accent: 'var(--primary-interactive-accent)',
            hover: 'var(--secondary-interactive-hover)',
          },
        },

        tertiary: {
          content: 'var(--tertiary-content)',
          interactive: {
            accent: 'var(--tertiary-interactive-accent)',
          },
        },

        positive: {
          sentiment: 'var(--positive-sentiment)',
          background: 'var(--positive-background)',
        },

        negative: {
          sentiment: 'var(--negative-sentiment)',
          background: 'var(--negative-background)',
        },

        warning: {
          sentiment: 'var(--warning-sentiment)',
          background: 'var(--warning-background)',
        },

        dialog: {
          background: 'var(--dialog-background)',
          interactive: {
            disabled: 'var(--dialog-dialog-interactive-disabled)',
          },
        },

        'elevated-background': 'var(--elevated-background)',
        'neutral-background': 'var(--neutral-background)',
        'overlay-background': 'var(--overlay-background)',

        'divider-border': 'var(--divider-border)',
      },
    },
  },

  plugins: [daisyuiPlugin],

  // https://daisyui.com/docs/config/
  daisyui: {
    darkTheme: 'dark', // name of one of the included themes for dark mode
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    rtl: false, // rotate style direction from left-to-right to right-to-left. You also need to add dir="rtl" to your html tag and install `tailwindcss-flip` plugin for Tailwind CSS.
    prefix: '', // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    logs: false, // Shows info about daisyUI version and used config in the console when building your CSS
    themes: [
      {
        dark: {
          'color-scheme': 'dark',
          '--btn-text-case': 'capitalize',

          '--primary-brand': '#FF7A3D', // sunrise (accent on dark)
          '--primary-content': '#F6F1EE', // grey-10
          '--primary-link': '#FF8A3D', // sunrise
          '--primary-link-hover': '#FFB27A',
          '--primary-icon': '#D2C6C0', // grey-100
          '--primary-background': '#140C0A', // grey-900
          '--primary-interactive': '#C2410C', // ember (active nav, buttons base)
          '--primary-interactive-accent': '#FF7A3D',
          '--primary-interactive-hover': '#2E211C', // grey-700
          '--primary-border-hover': '#FF8A3D',
          '--primary-border-dark': '#6E5A52', // grey-500
          '--primary-border-accent': '#FF7A3D',
          '--primary-base-background': '#FFFFFF',
          '--primary-base-content': '#221713',

          '--secondary-brand': '#FF7A3D',
          '--secondary-content': '#BFA99F', // grey-200
          '--secondary-icon': '#2E211C',

          '--secondary-interactive-accent': '#2E211C',
          '--secondary-interactive-hover': '#BFA99F',

          '--tertiary-content': '#806C64', // grey-400
          '--tertiary-interactive-accent': '#6E5A52',
          '--tertiary-interactive-hover': '#45342D',

          '--positive-sentiment': '#47E0A0',
          '--positive-background': '#00321D',

          '--negative-sentiment': '#F15C5D',
          '--negative-background': '#440000',

          '--warning-sentiment': '#EBB222',
          '--warning-background': '#382800',

          '--neutral-sentiment': '#0052CC',
          '--neutral-sentiment-background': '#002966',

          '--elevated-background': '#221713', // grey-800
          '--neutral-background': '#2E211C', // grey-700
          '--neutral-content': '#2E211C',
          '--neutral-accent': '#2E211C',
          '--overlay-background': 'rgba(20, 12, 10, 0.5)',
          '--overlay-dialog': 'rgba(20, 12, 10, 0.90)',
          '--divider-border': '#45342D', // grey-600

          '--dialog-background': '#2E211C',
          '--dialog-dialog-interactive-disabled': '#45342D',

          // ================================ //

          primary: '#C2410C', // ember; buttons also get the sunrise gradient (styles/brand.css)
          'primary-focus': '#D9521C',
          'primary-content': '#FFFFFF',

          secondary: '#FF7A3D',
          'secondary-content': '#BFA99F',

          neutral: '#2E211C',
          'neutral-focus': '#45342D',
          'neutral-content': '#F6F1EE',

          'base-100': '#140C0A',
          'base-content': '#F6F1EE',

          success: '#00321D',
          'success-content': '#47E0A0',
          error: '#440000',
          'error-content': '#F15C5D',
          warning: '#382800',
          'warning-content': '#EBB222',
        },

        light: {
          'color-scheme': 'light',
          '--btn-text-case': 'capitalize',

          '--primary-brand': '#C2410C', // ember
          '--primary-content': '#1A1014', // ink
          '--primary-link': '#C2410C',
          '--primary-link-hover': '#9A3412',
          '--primary-icon': '#6E5A52', // grey-500
          '--primary-background': '#FFFAF6', // ivory
          '--primary-interactive': '#1A1014', // ink buttons on light
          '--primary-interactive-accent': '#C2410C',
          '--primary-interactive-hover': '#F2E9E4',
          '--primary-border-hover': '#FF8A3D',
          '--primary-border-accent': '#C2410C',

          '--primary-base-background': '#FFFFFF',
          '--primary-base-content': '#1A1014',

          '--secondary-brand': '#C2410C',
          '--secondary-content': '#45342D', // grey-600
          '--secondary-icon': '#2E211C',
          '--secondary-interactive-accent': '#E9E1DC',
          '--secondary-interactive-hover': '#F6F1EE',

          '--tertiary-content': '#806C64', // grey-400

          '--tertiary-interactive-hover': '#45342D',
          '--tertiary-interactive-accent': '#6E5A52',

          '--positive-sentiment': '#005E36',
          '--positive-background': '#BFFFE4',

          '--negative-sentiment': '#BB1A1B',
          '--negative-background': '#FFE7E7',

          '--warning-sentiment': '#775602',
          '--warning-background': '#FFF6DE',

          '--elevated-background': '#FFFAF6',
          '--neutral-background': '#FFFFFF',
          '--neutral-content': '#1A1014',
          '--neutral-accent': '#E9E1DC',
          '--overlay-background': 'rgba(26, 16, 20, 0.2)',
          '--overlay-dialog': 'rgba(26, 16, 20, 0.9)',

          '--dialog-background': '#FFFFFF',
          '--dialog-dialog-interactive-disabled': '#E9E1DC',

          '--divider-border': '#D2C6C0', // grey-100

          // ================================ //

          primary: '#1A1014', // ink
          'primary-focus': '#2E211C',
          'primary-content': '#FFFFFF',

          secondary: '#C2410C',
          'secondary-content': '#45342D',

          neutral: '#E9E1DC',
          'neutral-focus': '#D2C6C0',
          'neutral-content': '#1A1014',

          'base-100': '#FFFAF6',
          'base-content': '#1A1014',

          success: '#BFFFE4',
          'success-content': '#005E36',
          error: '#FFE7E7',
          'error-content': '#BB1A1B',
          warning: '#FFF6DE',
          'warning-content': '#775602',
        },
      },
    ],
  },
};

export default config;
