import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { defineConfig } from 'vitepress'
import { groupIconMdPlugin as MarkdownItGroupIcon } from 'vitepress-plugin-group-icons'

// https://vitepress.dev/reference/site-config
export default defineConfig({
	base: '/valchecker/',
	title: 'valchecker',
	description: 'Modular runtime validation for TypeScript with full type inference',
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: 'Guide', link: '/guide/quick-start' },
			{ text: 'API Reference', link: '/api/overview' },
			{ text: 'Examples', link: '/examples/async-validation' },
		],

		sidebar: [
			{
				text: 'Guide',
				items: [
					{ text: 'Quick Start', link: '/guide/quick-start' },
					{ text: 'Core Philosophy', link: '/guide/core-philosophy' },
				],
			},
			{
				text: 'API Reference',
				items: [
					{ text: 'Overview', link: '/api/overview' },
					{ text: 'Primitives', link: '/api/primitives' },
					{ text: 'Structures', link: '/api/structures' },
					{ text: 'Transforms', link: '/api/transforms' },
					{ text: 'Helpers & Utilities', link: '/api/helpers' },
				],
			},
			{
				text: 'Examples',
				items: [
					{ text: 'Async Validation', link: '/examples/async-validation' },
					{ text: 'Custom Messages', link: '/examples/custom-messages' },
					{ text: 'Fallback Chains', link: '/examples/fallback-chains' },
					{ text: 'Issue Paths', link: '/examples/issue-paths' },
				],
			},
		],

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
