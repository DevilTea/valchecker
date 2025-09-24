import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { defineConfig } from 'vitepress'
import { groupIconMdPlugin as MarkdownItGroupIcon } from 'vitepress-plugin-group-icons'

// https://vitepress.dev/reference/site-config
export default defineConfig({
	base: '/valchecker/',
	title: 'valchecker',
	description: 'Document for valchecker',
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'API', link: '/api/core' },
		],

		sidebar: {
			'/guide/': [
				{
					text: 'Introduction',
					items: [
						{ text: 'What is valchecker?', link: '/guide/introduction' },
						{ text: 'Getting Started', link: '/guide/getting-started' },
						{ text: 'Core Concepts', link: '/guide/core-concepts' },
					],
				},
				{
					text: 'Advanced',
					items: [
						{ text: 'Examples', link: '/guide/examples' },
						{ text: 'Advanced Topics', link: '/guide/advanced' },
					],
				},
			],
			'/api/': [
				{
					text: 'API Reference',
					items: [
						{ text: 'Core API', link: '/api/core' },
						{ text: 'Schema Constructors', link: '/api/schemas' },
						{ text: 'Pipe Operations', link: '/api/pipe' },
					],
				},
			],
		},

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/DevilTea/valchecker' },
		],
	},

	markdown: {
		config: (md) => {
			md.use(MarkdownItGroupIcon)
		},
		codeTransformers: [
			transformerTwoslash(),
		],
		languages: ['js', 'jsx', 'ts', 'tsx'],
	},
})
