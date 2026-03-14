export const normalizeDigits = (value?: string | null) => {
    if (!value) return '';
    return value
        .toString()
        .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
};

export const normalizeSearchText = (value?: string | null) => {
    if (!value) return '';
    return normalizeDigits(value)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        .replace(/Ù€/g, '')
        .replace(/[Ø¥Ø£Ø¢Ù±]/g, 'Ø§')
        .replace(/Ø¤/g, 'Ùˆ')
        .replace(/Ø¦/g, 'ÙŠ')
        .replace(/Ù‰/g, 'ÙŠ')
        .replace(/Ø¡/g, '')
        .replace(/\s+/g, ' ');
};
