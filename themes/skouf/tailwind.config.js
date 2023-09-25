/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["themes/skouf/layouts/**/*.html"],
  theme: {
    colors: {
      'hero-green': '#6af4a2',
      'dark-green': '#00571A',
      'dark-blue-grey': '#47565c',
      'light-blue-grey': '#F1F5F7',
      'light-ocean-blue': '#31A6D6',
      'dark-ocean-blue': '#3061A5',
    },
    fontFamily: {
      sans: ['Roboto', 'sans-serif']
    },
    extend: {
      spacing: {
        '3/4': '75%',
      },
      typography: ({theme}) => ({
        DEFAULT: {
          css: {
            h2: {
              'border-left': `5px solid ${theme('colors.hero-green')}`,
              'padding-left': '0.5em'
            }
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}

