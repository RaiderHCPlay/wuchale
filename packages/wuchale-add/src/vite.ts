import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tsPlugin } from '@sveltejs/acorn-typescript'
import { type Node, Parser, type Program } from 'acorn'
import MagicString from 'magic-string'
import type { DetectProjectResult } from './types.js'

const parser = Parser.extend(tsPlugin())
let hasImport = false
const hasPlugin = { exist: false, pos: 0 }

export function writeViteConfig(project: DetectProjectResult) {
    if (!project.hasViteConfig) {
        return
    }

    const viteFileExtension = checkViteConfigFile()

    const content = readFileSync(`./vite.config.${viteFileExtension}`, 'utf8')
    const ast = parser.parse(content, {
        sourceType: 'module',
        ecmaVersion: 'latest',
    })

    const s = new MagicString(content)

    for (const node of ast.body) {
        walkNodes(node)
    }

    if (!hasImport) {
        s.prepend("import { wuchale } from 'wuchale/vite'\n")
    }

    if (!hasPlugin.exist) {
        s.appendLeft(hasPlugin.pos, 'wuchale(), ')
    }

    const result = s.toString()
    writeFileSync(`./vite.config.${viteFileExtension}`, result)
}

function checkViteConfigFile(): string {
    if (existsSync('./vite.config.ts')) return 'ts'
    else return 'js'
}

function walkNodes(node: Node) {
    for (const [key, value] of Object.entries(node)) {
        if (Array.isArray(value)) {
            for (const child of value) {
                walkNodes(child)
            }
        } else if (typeof value === 'object' && value !== null) {
            walkNodes(value)
        }

        if (node.type === 'Property') {
            const property = node as any
            if (property.key.name === 'plugins') {
                const arr = property.value
                for (const element of arr.elements) {
                    if (element.callee.name === 'wuchale') {
                        hasPlugin.exist = true
                    }
                }
                if (!hasPlugin.exist) {
                    hasPlugin.pos = arr.start + 1
                }
            }
        }

        if (node.type === 'ImportDeclaration') {
            const importNode = node as any
            for (const spec of importNode.specifiers) {
                if (spec.type === 'ImportSpecifier') {
                    if (spec.imported.type === 'Identifier') {
                        if (spec.imported.name === 'wuchale') {
                            hasImport = true
                        }
                    }
                }
            }
        }
    }
}
