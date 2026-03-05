import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', '"DM Sans"', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
      },
      colors: {
        bg: '#fff',
        bg2: '#f8f7f5',
        bg3: '#f0ede8',
        bg4: '#e8e4dd',
        border: '#e5e1db',
        border2: '#d5d0c8',
        text: '#1c1b18',
        text2: '#6b6860',
        text3: '#a8a49c',
        accent: '#1a56db',
        acl: '#eff4ff',
        acb: '#c3d4fd',
        gold: '#8a5c0a',
        goldl: '#fdf6e8',
        goldb: '#edd89a',
        green: '#15803d',
        greenl: '#f0fdf4',
        greenb: '#86efac',
        red: '#b91c1c',
        redl: '#fff5f5',
        purple: '#7c3aed',
        purplel: '#f5f3ff',
        orange: '#c2410c',
        orangel: '#fff7ed',
        pink: '#be185d',
        pinkl: '#fdf2f8',
        linkedin: '#0a66c2',
        xblack: '#000',
        substack: '#ff6719',
        rednote: '#ff2442',
      },
    },
  },
  plugins: [],
};
export default config;
