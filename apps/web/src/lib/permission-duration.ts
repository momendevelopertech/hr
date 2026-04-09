export const formatPermissionDuration = (hours: number, locale: 'en' | 'ar') => {
    const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
    const totalMinutes = Math.round(safeHours * 60);
    const hourPart = Math.floor(totalMinutes / 60);
    const minutePart = totalMinutes % 60;

    if (locale === 'ar') {
        if (hourPart > 0 && minutePart > 0) return `${hourPart} ساعة و${minutePart} دقيقة`;
        if (hourPart > 0) return `${hourPart} ساعة`;
        return `${minutePart} دقيقة`;
    }

    if (hourPart > 0 && minutePart > 0) return `${hourPart}h ${minutePart}m`;
    if (hourPart > 0) return `${hourPart}h`;
    return `${minutePart}m`;
};
