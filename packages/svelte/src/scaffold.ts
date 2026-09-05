import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tsPlugin } from '@sveltejs/acorn-typescript'
import { type Node, Parser, type Program } from 'acorn'
import MagicString from 'magic-string'
import { type AST, compile, compileModule, parse, print } from 'svelte/compiler'

interface DetectProjectResult {
    packages: Packages[]
    hasTailwind: boolean
    isTypeScript: boolean
}

interface Packages {
    kind: string
    adapter: string
    choosable: boolean
}

interface ScaffoldContext {
    project: DetectProjectResult
    locales: string[]
}

const parser = Parser.extend(tsPlugin())
let isFirstImport = true

export async function scaffold(ctx: ScaffoldContext) {
    const isKit = ctx.project.packages.some(p => p.kind === 'sveltekit')
    const locale = ctx.locales[0] ?? 'en'
    const hasTailcss = ctx.project.hasTailwind
    const ext = ctx.project.isTypeScript ? 'ts' : 'js'

    if (isKit) {
        scaffoldSvelteKit(ext, locale)
    } else {
        scaffoldPlainSvelte(locale, ctx.project.packages)
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
        writeFileSync(hooksFile.file, '')
    }

    writeFileSync(hooksFile.file, transformHooksFile(hooksFile, locale))

    if (!existsSync(layoutFile.file)) {
        writeFileSync(layoutFile.file, '')
    }

    writeFileSync(layoutFile.file, transformLayoutFile(layoutFile, locale))
}

function transformHooksFile(hooksFile: { file: string; isTs: boolean }, locale: string): string {
    const content = readFileSync(hooksFile.file, 'utf8')
    const ast = parser.parse(content, {
        sourceType: 'module',
        ecmaVersion: 'latest',
    })
    const s = new MagicString(content)

    const lastImportEnd = getLastImportEnd(ast)
    isFirstImport = lastImportEnd !== 0
    const imports = [
        {
            imports: '* as svelte',
            from: './locales/svelte.loader.server.svelte.js',
        },
        {
            imports: '* as js',
            from: './locales/js.loader.server.js',
        },
        {
            imports: '{ runWithLocale, loadLocales }',
            from: 'wuchale/load-utils/server',
        },
        {
            imports: '{ locales }',
            from: './locales/data.js',
        },
    ]

    if (hooksFile.isTs) {
        imports.push({
            imports: 'type { Handle }',
            from: '@sveltejs/kit',
        })
    }

    for (const impt of imports) {
        addImport(ast, s, lastImportEnd, impt)
    }

    if (!content.includes('loadLocales(svelte.key')) {
        s.append('\nloadLocales(svelte.key, svelte.loadCount, svelte.loadCatalog, locales)')
    }

    if (!content.includes('loadLocales(js.key')) {
        s.append('\nloadLocales(js.key, js.loadCount, js.loadCatalog, locales)\n')
    }

    const handleNode = findHandleNode(ast)
    const sequenceNode = findSequenceNode(ast)
    const handleName = handleNode || sequenceNode ? 'i18n' : 'handle'

    if (handleNode && !content.includes('await runWithLocale')) {
        s.replace(/\bexport\b\s+(async\s+)?function\s+handle\b/g, '$1function handler')
        s.replace(/\bexport\b\s+const\s+handle\b/g, 'const handler')
    }

    if (!content.includes('export const i18n') && !content.includes('await runWithLocale')) {
        s.append(`\n${handleNode ? '' : 'export '}const ${handleName}${hooksFile.isTs ? ': Handle' : ''} = async ({ event, resolve }) => {
    const locale = event.url.searchParams.get('locale') ?? '${locale}'
    return await runWithLocale(locale, () => resolve(event))
}\n`)
    }

    if (
        !sequenceNode &&
        handleNode &&
        !content.includes('sequence(handler') &&
        !content.includes('await runWithLocale')
    ) {
        addImport(ast, s, lastImportEnd, {
            from: '@sveltejs/kit/hooks',
            imports: '{ sequence }',
        })

        s.append('\nexport const handle = sequence(handler, i18n)')
    }

    if (sequenceNode) {
        const sequenceArgs = sequenceNode.declaration?.declarations?.[0]?.init.arguments
        const hasI18nArg = sequenceArgs.some((arg: any) => arg.type === 'Identifier' && arg.name === 'i18n')
        if (!hasI18nArg) {
            sequenceArgs.push({
                type: 'Identifier',
                name: 'i18n',
                start: 0,
                end: 0,
            })
        }

        const argNames = sequenceArgs.map((arg: any) => arg.name).join(', ')

        const index = ast.body.indexOf(sequenceNode)
        ast.body.splice(index, 1)

        s.replace(
            /\bexport\s+const\s+handle\s+=\s+sequence\s*\([^)]*\)/g,
            `export const handle = sequence(${argNames})`,
        )
    }

    return s.toString()
}

function transformLayoutFile(layoutFile: { file: string; isTs: boolean }, locale: string): string {
    const content = readFileSync(layoutFile.file, 'utf8')
    const ast = parser.parse(content, { ecmaVersion: 'latest', sourceType: 'module' })
    const s = new MagicString(content)

    const lastImportEnd = getLastImportEnd(ast)
    isFirstImport = lastImportEnd !== 0
    const imports = [
        {
            imports: `{ ${layoutFile.isTs ? 'type Locale, ' : ''}locales }`,
            from: '../locales/data.js',
        },
        {
            imports: '{ browser }',
            from: '$app/environment',
        },
        {
            imports: '{ loadLocale }',
            from: 'wuchale/load-utils',
        },
        {
            from: '../locales/js.loader.js',
        },
        {
            from: '../locales/svelte.loader.svelte.js',
        },
    ]

    if (layoutFile.isTs) {
        imports.push({
            imports: 'type { LayoutLoad }',
            from: './$types',
        })
    }

    for (const impt of imports) {
        addImport(ast, s, lastImportEnd, impt)
    }

    const loadNode = ast.body.find(node => {
        if (node.type !== 'ExportNamedDeclaration') return undefined

        if (node.declaration?.type === 'VariableDeclaration') {
            return node.declaration.declarations.some((d: any) => d.id?.name === 'load')
        }

        return undefined
    }) as any

    if (!loadNode) {
        s.append(`export const load${layoutFile.isTs ? ': LayoutLoad' : ''} = async ({url}) => {
    const locale = url.searchParams.get('locale') ?? '${locale}'
    if (browser && locales.includes(locale ${layoutFile.isTs ? 'as Locale' : ''})) {
        await loadLocale(locale)
    }
}`)
    } else {
        const loadDeclaration = loadNode.declaration.declarations.find((node: any) => {
            if (node.id.name === 'load') return node
            return undefined
        })

        if (layoutFile.isTs && !content.includes(': LayoutLoad')) {
            s.appendRight(loadDeclaration.id.end, ': LayoutLoad')
        }
        const loadParameters = loadDeclaration.init.params
        let argsStart: number

        if (loadParameters.length > 0) {
            argsStart = loadParameters[0].start
        } else {
            const arrowStart = content.indexOf('=>', loadDeclaration.init.start)
            argsStart = content.lastIndexOf('(', arrowStart)
            argsStart++
        }

        let hasUrl: boolean = false

        if (!loadParameters || loadParameters.length === 0) {
            s.appendRight(argsStart, '{ url }')
            hasUrl = true
        }

        for (const param of loadParameters) {
            for (const prop of param.properties) {
                if (prop.key.name === 'url') {
                    hasUrl = true
                    break
                }
            }
            if (hasUrl) break
        }

        if (!hasUrl) {
            s.appendLeft(++argsStart, ` url,`)
        }

        const block = loadDeclaration.init.body

        if (!content.includes('const locale = url.searchParams.get')) {
            const localeDecl = `\nconst locale = url.searchParams.get('locale') ?? '${locale}';\n`
            const ifStatement = `if (browser && locales.includes(locale ${
                layoutFile.isTs ? 'as Locale' : ''
            })) { await loadLocale(locale); }\n`
            s.appendRight(++block.start, `${localeDecl}${ifStatement}`)
        }
    }

    return s.toString()
}

function findHandleNode(ast: Program) {
    return ast.body.find((node: any) => {
        if (node.type !== 'ExportNamedDeclaration') return undefined

        if (node.declaration?.type === 'VariableDeclaration') {
            return node.declaration.declarations.find(
                (d: any) => d.id?.name === 'handle' && d.init?.callee?.name !== 'sequence',
            )
        }

        if (node.declaration?.type === 'FunctionDeclaration') {
            return node.declaration.id.name === 'handle'
        }

        return undefined
    }) as Node
}

function findSequenceNode(ast: Program) {
    return ast.body.find((node: any) => {
        if (node.type !== 'ExportNamedDeclaration') return false
        if (node.declaration?.type === 'VariableDeclaration') {
            return node.declaration?.declarations.some(
                (d: any) =>
                    d.id?.name === 'handle' && d.init?.type === 'CallExpression' && d.init?.callee?.name === 'sequence',
            )
        }
        return false
    }) as any
}

function getLastImportEnd(ast: Program): number {
    for (const [i, node] of ast.body.entries()) {
        if (node.type === 'ImportDeclaration' && ast.body[i + 1]?.type !== 'ImportDeclaration') {
            return node.end
        }
    }
    return 0
}

function addImport(ast: Program, s: MagicString, lastImportEnd: number, impt: { imports?: string; from: string }) {
    let imptFound = false
    for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') {
            if (node.source.value === impt.from) {
                imptFound = true
            }
        }
    }

    if (!imptFound) {
        s.appendLeft(
            lastImportEnd,
            `${isFirstImport ? '\n' : ''}import ${impt.imports ? `${impt.imports} from ` : ''}'${impt.from}'\n`,
        )
        isFirstImport = false
    }
}

// Plain Svelte transformations
function scaffoldPlainSvelte(locale: string, packages: Packages[]) {
    if (!existsSync('src')) {
        mkdirSync('src')
    }

    if (!existsSync('src/App.svelte')) {
        writeFileSync('src/App.svelte', '')
    }

    writeFileSync('src/App.svelte', transformPlainSvelte(locale, packages))
}

function transformPlainSvelte(locale: string, packages: Packages[]): string {
    const content = readFileSync('src/App.svelte', 'utf8')
    const ast = parse(content, { modern: true })
    const imports = [
        {
            imports: '{ loadLocale }',
            from: 'wuchale/load-utils',
        },
        {
            from: `./locales/${packages.length > 1 ? 'svelte' : 'main'}.loader.svelte.js`,
        },
    ]

    let scriptContentString = '<script>'

    for (const impt of imports) {
        const exists = checkImport(ast, impt)

        if (!exists) {
            scriptContentString += `import ${impt.imports ? `${impt.imports} from ` : ''}'${impt.from}'\n`
        }
    }
    if (!content?.includes('let locale = $state')) {
        scriptContentString += `let locale = $state('${locale}')`
    }

    scriptContentString += '</script>'

    const injectedScript = parse(scriptContentString, { modern: true })
    const injectedContent = injectedScript.instance?.content.body
    if (injectedContent) ast.instance?.content.body.push(...injectedContent)

    if (!content?.includes('#await loadLocale')) {
        const nodes = ast.fragment.nodes

        const existingHtml: string[] = []
        for (const node of nodes) {
            const element = content.slice(node.start, node.end)
            existingHtml.push(element)
        }

        ast.fragment.nodes = []

        const newHTML = `{#await loadLocale(locale)}
            	<!-- Ignored because it is rendered before the catalog is loaded -->
            	<!-- @wc-ignore -->
        	Loading translations...
        {:then}
        ${existingHtml
            .join('')
            .split('\n')
            .map(line => `\t${line}`)
            .join('\n')}
        {/await}`

        const newHTMLParse = parse(newHTML, { modern: true })
        const htmlBody = newHTMLParse.fragment.nodes
        ast.fragment.nodes.push(...htmlBody)
    }
    return print(ast).code
}

function checkImport(ast: AST.Root, impt: { imports?: string; from: string }) {
    let imptFound = false
    const body = ast.instance?.content.body ?? []
    for (const node of body) {
        if (node.type === 'ImportDeclaration') {
            if (node.source.value === impt.from) {
                imptFound = true
            }
        }
    }

    return imptFound
}

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

    if (!content.includes('@source not "../locales/"')) {
        const newContent = `@source not "../locales/"\n${content};`
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
