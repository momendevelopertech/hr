import { normalizeDigits } from './search-normalization';

const LOCAL_EGYPT_MOBILE = /^01\d{9}$/;
const INTERNATIONAL_EGYPT_MOBILE = /^201\d{9}$/;
const INTERNATIONAL_EGYPT_MOBILE_WITH_EXIT = /^00201\d{9}$/;
const EGYPT_MOBILE_WITHOUT_LEADING_ZERO = /^1\d{9}$/;

export const normalizeEgyptMobilePhone = (value?: string | null) => {
    const digits = normalizeDigits(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (LOCAL_EGYPT_MOBILE.test(digits)) return digits;
    if (INTERNATIONAL_EGYPT_MOBILE.test(digits)) return `0${digits.slice(2)}`;
    if (INTERNATIONAL_EGYPT_MOBILE_WITH_EXIT.test(digits)) return `0${digits.slice(4)}`;
    if (EGYPT_MOBILE_WITHOUT_LEADING_ZERO.test(digits)) return `0${digits}`;
    return digits;
};

export const isEgyptianMobilePhone = (value?: string | null) => {
    return LOCAL_EGYPT_MOBILE.test(normalizeEgyptMobilePhone(value));
};

export const formatEgyptMobileForWhatsApp = (value?: string | null) => {
    const local = normalizeEgyptMobilePhone(value);
    if (!LOCAL_EGYPT_MOBILE.test(local)) return '';
    return `20${local.slice(1)}`;
};
