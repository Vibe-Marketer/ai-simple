/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './public/**/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // AI Simple brand red
        brand: {
          DEFAULT: '#ef233c',
          dark: '#c81e32',
          light: '#ff4d63',
        }
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        manrope: ['Manrope', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'monospace'],
        'space-mono': ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const rotateXUtilities = {};
      const rotateYUtilities = {};
      const rotateValues = [0, 5, 10, 15, 20, 30, 45, 75];
      const transform3d = 'translate3d(var(--tw-translate-x,0),var(--tw-translate-y,0),var(--tw-translate-z,0)) rotateX(var(--tw-rotate-x,0)) rotateY(var(--tw-rotate-y,0)) rotateZ(var(--tw-rotate-z,0)) skewX(var(--tw-skew-x,0)) skewY(var(--tw-skew-y,0)) scaleX(var(--tw-scale-x,1)) scaleY(var(--tw-scale-y,1))';

      rotateValues.forEach((v) => {
        rotateXUtilities[`.rotate-x-${v}`] = { '--tw-rotate-x': `${v}deg`, transform: transform3d };
        if (v !== 0) rotateXUtilities[`.-rotate-x-${v}`] = { '--tw-rotate-x': `-${v}deg`, transform: transform3d };
        rotateYUtilities[`.rotate-y-${v}`] = { '--tw-rotate-y': `${v}deg`, transform: transform3d };
      });

      addUtilities({
        ...rotateXUtilities,
        ...rotateYUtilities,
        '.perspective-none': { perspective: 'none' },
        '.perspective-dramatic': { perspective: '100px' },
        '.perspective-near': { perspective: '300px' },
        '.perspective-normal': { perspective: '500px' },
        '.perspective-midrange': { perspective: '800px' },
        '.perspective-distant': { perspective: '1200px' },
        '.transform-style-preserve-3d': { 'transform-style': 'preserve-3d' },
        '.transform-style-flat': { 'transform-style': 'flat' },
      });
    },
  ],
};
