import { matchesEmployeeSearch, normalizeDigits, normalizeSearchText } from './search-normalization';

describe('search-normalization', () => {
    describe('normalizeDigits', () => {
        it('normalizes Arabic-Indic digits', () => {
            expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
        });

        it('normalizes Eastern Arabic digits', () => {
            expect(normalizeDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
        });
    });

    describe('normalizeSearchText', () => {
        it('lowercases and collapses whitespace', () => {
            expect(normalizeSearchText('  John   Doe  ')).toBe('john doe');
        });

        it('strips Arabic diacritics', () => {
            const value = 'مُوظَّف';
            expect(normalizeSearchText(value)).toBe('موظف');
        });
    });

    describe('matchesEmployeeSearch', () => {
        const user = {
            fullName: 'John Doe',
            fullNameAr: 'جون دو',
            employeeNumber: 'EMP-001',
            phone: '01012345678',
        };

        it('matches by name', () => {
            expect(matchesEmployeeSearch('john', user)).toBe(true);
            expect(matchesEmployeeSearch('جون', user)).toBe(true);
        });

        it('matches by employee number', () => {
            expect(matchesEmployeeSearch('emp-00', user)).toBe(true);
        });

        it('matches by phone digits', () => {
            expect(matchesEmployeeSearch('010123', user)).toBe(true);
            expect(matchesEmployeeSearch('999999', user)).toBe(false);
        });
    });
});
