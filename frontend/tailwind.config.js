/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cores da identidade Gran Villar (baseadas na logo).
        brand: {
          50: '#eefaf0',
          100: '#d5f2da',
          200: '#ace4b6',
          300: '#77d189',
          400: '#42b95f',
          500: '#22a33f',
          600: '#1a8735', // verde principal (botões/cabeçalho)
          700: '#166d2c', // hover
          800: '#145626',
          900: '#0f4620',
        },
        brandYellow: {
          50: '#fdf8e6', // fundo claro (etiqueta de preço alterado)
          300: '#f0d466',
          400: '#ffd21a',
          500: '#f4c400',
          700: '#8a6d00', // texto legível sobre fundo claro
          800: '#6b5400',
        },
        brandRed: {
          500: '#e02718',
          600: '#c51f12',
        },
      },
    },
  },
  plugins: [],
};
