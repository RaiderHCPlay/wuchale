export const STYLE = {
    RESET: '\x1b[0m',

    BOLD: '\x1b[1m',
    DIM: '\x1b[2m',

    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    BLUE: '\x1b[38;2;128;220;209m',
    DARK: '\x1b[38;2;24;42;47m',
    COMMAND: '\x1b[38;2;255;198;109m',
    WEBSITE: '\x1b[38;2;198;160;255m',
}

export function style(text: string, ...styles: string[]) {
    return `${styles.join('')}${text}${STYLE.RESET}`
}

export function errorText(text: string) {
    return `${STYLE.RED}${STYLE.DIM}${text}${STYLE.RESET}`
}

export function successText(text: string) {
    return `${STYLE.GREEN}${text}${STYLE.RESET}`
}
