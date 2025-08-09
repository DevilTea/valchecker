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
			{ text: 'Examples', link: '/markdown-examples' },
		],

		sidebar: [
			{
				text: 'Examples',
				items: [
					{ text: 'Markdown Examples', link: '/markdown-examples' },
					{ text: 'Runtime API Examples', link: '/api-examples' },
				],
			},
		],

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/vuejs/vitepress' },
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
