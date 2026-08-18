/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				montserrat: ['Montserrat', 'Helvetica', 'Arial', 'sans-serif'],
			},
			colors: {
				cream: '#faf8f5',
				charcoal: '#1a1a1a',
				warmgray: '#5a5a5a',
				warmborder: '#e8e4df',
				slateblue: '#3a5a7c',
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
	darkMode: "class"
}
