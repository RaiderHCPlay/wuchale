import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export function writeGitignore() {
    if (existsSync('.gitignore')) {
        let content = readFileSync('.gitignore', 'utf8')
        if (content.includes('.wuchale')) return
        content += '\n#Wuchale\n.wuchale\n'
        writeFileSync('.gitignore', content, 'utf8')
    }
}
