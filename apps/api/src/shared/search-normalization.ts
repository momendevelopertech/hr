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

export const matchesEmployeeSearch = (
    query: string,
    user: { fullName?: string | null; fullNameAr?: string | null; employeeNumber?: string | null; phone?: string | null },
) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    const nameStack = normalizeSearchText(`${user.fullName || ''} ${user.fullNameAr || ''}`);
    if (nameStack.includes(normalizedQuery)) return true;
    const employeeNumber = normalizeDigits(user.employeeNumber || '').toLowerCase();
    if (employeeNumber.includes(normalizedQuery)) return true;
    const queryDigits = normalizeDigits(query).replace(/\D/g, '');
    if (!queryDigits) return false;
    const phoneDigits = normalizeDigits(user.phone || '').replace(/\D/g, '');
    return !!phoneDigits && phoneDigits.includes(queryDigits);
};
