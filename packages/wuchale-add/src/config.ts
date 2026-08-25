import { writeFileSync } from 'node:fs'
import type { AdapterConfig, DetectProjectResult, PairedAdapterConfig, ProjectKind } from './types.js'

export function writeWuchaleConfig(project: DetectProjectResult, locales: string[]) {
    if (project.hasWuchaleConfig) {
        return
    }

    writeFileSync('./wuchale.config.js', generateConfigContent(project, locales), 'utf-8')
}

function generateConfigContent(project: DetectProjectResult, locales: string[]) {
    const configs: AdapterConfig[] = []

    let adapterConfigs = ''
    let wuchaleConfigContent = '// @ts-check\n'

    for (const pkg of project.packages) {
        if (project.packageOverrides[pkg.kind]) {
            continue
        }
        configs.push(getAdapterConfig(pkg.kind, project.hasViteConfig))
    }
    const pairedConfigs: PairedAdapterConfig[] = configs.flatMap(conf =>
        conf.import.map((imp, index) => ({
            import: imp,
            content: conf.content[index]!,
        })),
    )

    for (const [index, adapter] of pairedConfigs.entries()) {
        const isLast = index === pairedConfigs.length - 1
        const name = pairedConfigs.length > 1 ? adapter.import.name : 'main'
        wuchaleConfigContent += `import { adapter as ${adapter.import.name} } from "${adapter.import.lib}"\n`
        adapterConfigs += `${name}: ${adapter.content}${isLast ? '' : ',\n\t'}`
    }

    wuchaleConfigContent += `import { defineConfig } from "wuchale"\n
export default defineConfig({
    locales: [${locales.map(locale => `"${locale}"`).join(', ')}],
    adapters: {
	${adapterConfigs}
    }
})
    `
    return wuchaleConfigContent
}

function getAdapterConfig(project: ProjectKind, hasViteConfig: boolean): AdapterConfig {
    switch (project) {
        case 'react':
            return {
                import: [{ name: 'jsx', lib: '@wuchale/jsx' }],
                content: ["jsx({ loader: 'react' })"],
            }
        case 'solid-js':
            return {
                import: [{ name: 'jsx', lib: '@wuchale/jsx' }],
                content: [
                    `jsx({
\t\t    loader: 'solidjs',
\t\t    variant: 'solidjs',
\t})`,
                ],
            }
        case 'svelte':
            return {
                import: [{ name: 'svelte', lib: '@wuchale/svelte' }],
                content: ["svelte({ loader: 'svelte' })"],
            }
        case 'sveltekit':
            return {
                import: [
                    { name: 'svelte', lib: '@wuchale/svelte' },
                    { name: 'js', lib: 'wuchale/adapter-vanilla' },
                ],
                content: [
                    "svelte({ loader: 'sveltekit' })",
                    `js({
    \t\tloader: 'vite',
    \t\tfiles: [
    \t\t    'src/**/+{page,layout}.{js,ts}',
    \t\t    'src/**/+{page,layout}.server.{js,ts}',
    \t\t],
\t})`,
                ],
            }
        case 'astro':
            return {
                import: [{ name: 'astro', lib: '@wuchale/astro' }],
                content: ['astro()'],
            }
        case 'vanilla':
            return {
                import: [{ name: 'basic', lib: 'wuchale/adapter-vanilla' }],
                content: [
                    `basic({
    \t\tloader: '${hasViteConfig ? 'vite' : 'default'}',
\t})`,
                ],
            }
    }
}
