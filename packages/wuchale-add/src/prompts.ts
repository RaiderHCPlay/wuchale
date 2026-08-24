import readline from 'node:readline'
import type { MultiboxPromptOptions, ProjectKind } from './types.js'

const displayName = new Intl.DisplayNames(['en'], { type: 'language' })

export function adapterMultiboxPrompt(adapters: ProjectKind[]): Promise<MultiboxPromptOptions[]> {
    return new Promise(resolve => {
        const options: MultiboxPromptOptions[] = adapters.map(adapter => ({
            name: adapter.charAt(0).toUpperCase() + adapter.slice(1),
            checked: true,
        }))

        let rendered = false
        let cursor = 0

        const render = () => {
            if (rendered) {
                const lines = options.length + 1
                readline.moveCursor(process.stdout, 0, -lines)
                readline.clearScreenDown(process.stdout)
            } else {
                rendered = true
            }

            process.stdout.write('\x1b[?25l')

            process.stdout.write('Detected adapters to install (Space = check/uncheck, Enter = accept)\n')
            options.forEach((option: MultiboxPromptOptions, index) => {
                const pointer = index === cursor ? '<' : ''
                const checked = option.checked ? '[x]' : '[]'

                process.stdout.write(`${checked} ${option.name} ${pointer}\n`)
            })
        }

        const cleanup = () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.off('data', onData)
            process.stdout.write('\x1b[?25h')
        }

        const onData = (key: string) => {
            switch (key) {
                case '\u0003':
                    cleanup()
                    process.stdin.write('Operation cancelled\n')
                    return process.exit(0)

                case '\r':
                    cleanup()
                    resolve(options)
                    return

                case ' ':
                    options[cursor]!.checked = !options[cursor]?.checked
                    break
                case '\u001b[A':
                    cursor = (cursor - 1 + options.length) % options.length
                    break

                case '\u001b[B':
                    cursor = (cursor + 1) % options.length
                    break
            }
            render()
        }

        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')
        render()

        process.stdin.on('data', onData)
    })
}

export function languagesPrompt(): Promise<string[]> {
    return new Promise(resolve => {
        let input = ''
        let rendered = false

        const render = (error = '') => {
            if (rendered) {
                process.stdout.write('\x1b[u')
                readline.moveCursor(process.stdout, 0, -1)
                readline.clearScreenDown(process.stdout)
            }

            rendered = true

            process.stdout.write('Which languages do you want to support? (e.g. en,zh-TW)\n')
            process.stdout.write('\x1b[s')

            process.stdout.write(`> ${input}`)
            if (error) process.stdout.write(`\n${error}`)
            readline.cursorTo(process.stdout, input.length + 2)
        }

        const cleanup = () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.off('data', onData)
        }

        const onData = (key: string) => {
            switch (key) {
                case '\u0003':
                    cleanup()
                    process.stdout.write('\nOperation cancelled\n')
                    return process.exit(0)

                case '\r': {
                    const { invalidTags, validTags } = parseLanguageInput(input)

                    if (invalidTags.length === 0) {
                        cleanup()
                        process.stdout.write('\n')
                        resolve(validTags.length ? validTags : ['en'])
                        return
                    }

                    render(checkInvalidTags(input) ?? undefined)
                    return
                }
                case '\u007f':
                    input = input.slice(0, -1)
                    break
                default:
                    input += key
            }

            render()
        }

        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        render()

        process.stdin.on('data', onData)
    })
}

export function confirmPrompt(text: string): Promise<boolean> {
    return new Promise(resolve => {
        let input = ''
        let rendered = false

        const render = (error = '') => {
            if (rendered) {
                process.stdout.write('\x1b[u')
                readline.moveCursor(process.stdout, 0, -1)

                readline.clearScreenDown(process.stdout)
            }
            rendered = true

            process.stdout.write(`${text}(Y/N): ${input}\n`)
            process.stdout.write('\x1b[s')

            if (error) process.stdout.write(`${error}`)

            readline.moveCursor(process.stdout, 0, -1)
            readline.cursorTo(process.stdout, text.length + input.length + 7)
        }

        const cleanup = () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.off('data', onData)
        }

        const onData = (key: string) => {
            switch (key) {
                case '\u0003':
                    cleanup()
                    process.stdout.write('\nOperation cancelled\n')
                    return process.exit(0)
                case '\r': {
                    const isValid = !!(input.toLowerCase() === 'y' || input.toLowerCase() === 'n')
                    if (!isValid) {
                        render('Not valid input')
                        return
                    }

                    if (input.toLowerCase() === 'y') resolve(true)
                    else resolve(false)
                    process.stdout.write('\n')
                    cleanup()
                    return
                }

                case '\u007f':
                    input = input.slice(0, -1)
                    break

                default:
                    input += key
            }
            render()
        }

        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        render()

        process.stdin.on('data', onData)
    })
}

function checkInvalidTags(data: string): string | undefined {
    const { invalidTags } = parseLanguageInput(data)

    if (invalidTags.length > 0) {
        if (invalidTags.length === 1) {
            return `Your input "${invalidTags[0]}" is not a valid BCP language tag`
        } else {
            const list = new Intl.ListFormat('en', {
                style: 'long',
                type: 'conjunction',
            })
            return `Your inputs ${list.format(invalidTags.map(x => `"${x}"`))} are not a valid BCP language tags`
        }
    }
}

function parseLanguageInput(input: string) {
    const potentialTags = input.replace(/[,\s]/g, ' ').split(' ').filter(Boolean)

    const validTags: string[] = []
    const invalidTags: string[] = []

    for (const tag of potentialTags) {
        if (validLanguageTag(tag)) validTags.push(tag)
        else invalidTags.push(tag)
    }

    return {
        invalidTags,
        validTags,
    }
}

function validLanguageTag(tag: string) {
    try {
        const name = displayName.of(tag)
        return name !== undefined && name !== tag
    } catch {
        return false
    }
}
