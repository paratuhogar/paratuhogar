const colors = ['cyan', 'orange', 'blue', 'indigo', 'emerald', 'purple'];
const payoutColors = ['amber', 'blue', 'emerald', 'violet'];

module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './catalog-maker.html',
    './admin-stats.js',
    './subgestor-tutorial.js',
    './system-events.js',
    './sistema-escuadron.js',
    // Include lazy modules too: production no longer generates utilities in the browser.
    './js/**/*.{js,mjs}',
    '!./js/**/*.min.js'
  ],
  safelist: [
    ...colors.flatMap(color => [
      `border-${color}-500`,
      `bg-${color}-500`,
      `bg-${color}-900/10`,
      `text-${color}-400`
    ]),
    // These utilities are assembled from the payout summary's finite color palette.
    ...payoutColors.flatMap(color => [
      `border-${color}-100`,
      `bg-${color}-50`,
      `text-${color}-700`,
      `text-${color}-950`
    ])
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a4789',
        secondary: '#2c6fb5',
        accent: '#cbd5e1',
        'background-light': '#f8fafc',
        'background-dark': '#0f172a'
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
};
