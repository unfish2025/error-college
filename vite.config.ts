import path from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	build: {
		target: 'es2015',
		lib: {
			entry: process.env.VITE_APP_PATH || './src/index.ts',
			name: 'ErrorCollege',
			formats: ['es'],
			fileName: 'index'
		}
	},
	resolve: {
		alias: {
			'@': path.resolve('./src'),
			'@tests': path.resolve('./tests')
		}
	},
	plugins: [
		dts({
			include: ['./src']
		})
	]
})
