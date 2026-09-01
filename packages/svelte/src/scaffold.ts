import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import MagicString from 'magic-string'

interface DetectProjectResult {
    packages: {
        kind: string
        adapter: string
        choosable: boolean
    }[]
    hasTailwind: boolean
    isTypeScript: boolean
}

interface ScaffoldContext {
    project: DetectProjectResult
    locales: string[]
}

export async function scaffold(ctx: ScaffoldContext) {
    const isKit = ctx.project.packages.some(p => p.kind === 'sveltekit')
    const locale = ctx.locales[0] ?? 'en'
    const hasTailcss = ctx.project.hasTailwind
    const ext = ctx.project.isTypeScript ? 'ts' : 'js'

    if (isKit) {
        scaffoldSvelteKit(ext, locale)
    } else {
        // scaffoldPlainSvelte(isTs, ext, hasTailcss, locale)
    }

    if (hasTailcss) {
        generateTailwind(isKit)
    }
}

// SvelteKit transformations

function scaffoldSvelteKit(ext: string, locale: string) {
    const hooksFile = resolveFile('src/hooks.server', ext)
    const layoutFile = resolveFile('src/routes/+layout', ext)

    if (!existsSync('src')) {
        mkdirSync('src')
    }

    if (!existsSync('src/routes')) {
        mkdirSync('src/routes')
    }

    if (!existsSync(hooksFile.file)) {
        writeFileSync(hooksFile.file, generateHooksConfig(hooksFile.isTs, locale))
    }

    if (!existsSync(layoutFile.file)) {
        writeFileSync(layoutFile.file, generateLayoutConfig(layoutFile.isTs, locale))
    }
}

function generateHooksConfig(isTs: boolean, locale: string): string {
    return `import * as svelte from './locales/svelte.loader.server.svelte.js'
import * as js from './locales/js.loader.server.js'
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { locales } from './locales/data.js'
${isTs ? "import type { Handle } from '@sveltejs/kit';" : ''}

loadLocales(svelte.key, svelte.loadCount, svelte.loadCatalog, locales)
loadLocales(js.key, js.loadCount, js.loadCatalog, locales)

export const handle${isTs ? ': Handle' : ''} = async ({ event, resolve }) => {
    const locale = event.url.searchParams.get('locale') ?? '${locale}'
    return await runWithLocale(locale, () => resolve(event))
}
`
}

function generateLayoutConfig(isTs: boolean, locale: string): string {
    return `${isTs ? "import type { LayoutLoad } from './$types';" : ''}
import '../locales/js.loader.js';
import '../locales/svelte.loader.svelte.js';
import { loadLocale } from 'wuchale/load-utils';
import { browser } from '$app/environment';
import { locales, type Locale } from '../locales/data.js';


export const load${isTs ? ': LayoutLoad' : ''} = async ({url}) => {
    const locale = url.searchParams.get('locale') ?? '${locale}'
    if (browser && locales.includes(locale ${isTs ? 'as Locale' : ''})) {
        await loadLocale(locale)
    }
}
`
}

// Plain Svelte transformations
// function scaffoldPlainSvelte(isTs: boolean, ext: string, hasTailcss: boolean, locale: string) {}

// Tailwind
function generateTailwind(isKit: boolean) {
    let stylesheetFile: string | undefined

    if (existsSync('src/routes/layout.css')) {
        stylesheetFile = 'src/routes/layout.css'
    } else if (existsSync('src/app.css')) {
        stylesheetFile = 'src/app.css'
    }

    if (!stylesheetFile) {
        stylesheetFile = isKit ? 'src/routes/layout.css' : 'src/app.css'
    }

    const content = readFileSync(stylesheetFile, 'utf8')

    if (!content.includes('@source not "../locales/";')) {
        const newContent = `@source not "../locales/"\n${content}`
        writeFileSync(stylesheetFile, newContent)
    }
}

// Utils
//
function resolveFile(file: string, ext: string): { file: string; isTs: boolean } {
    if (existsSync(path.resolve(`${file}.ts`))) {
        return { file: `${file}.ts`, isTs: true }
    } else if (existsSync(path.resolve(`${file}.js`))) {
        return { file: `${file}.js`, isTs: false }
    } else {
        return { file: `${file}.${ext}`, isTs: ext === 'ts' }
    }
}
