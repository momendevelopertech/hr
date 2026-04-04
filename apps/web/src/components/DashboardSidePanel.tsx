'use client';

import { useTranslations } from 'next-intl';
import SmartAttendanceCard, { type SmartAttendanceData } from './calendar/SmartAttendanceCard';

type SideItem = {
    id: string;
    name: string;
    type: string;
    time?: string;
    color: 'accent' | 'amber' | 'teal' | 'violet' | 'rose';
};

type StatItem = {
    id: string;
    label: string;
    value: string;
    color: 'accent' | 'amber' | 'teal' | 'violet' | 'rose';
};

export default function DashboardSidePanel({
    attendanceData,
    quickGlance,
    pendingStats,
    todayItems,
    approvalItems,
    deductionStats,
    deductionHint,
}: {
    attendanceData: SmartAttendanceData;
    quickGlance: StatItem[];
    pendingStats: StatItem[];
    todayItems: SideItem[];
    approvalItems: SideItem[];
    deductionStats: StatItem[];
    deductionHint?: string;
}) {
    const t = useTranslations('dashboard');
    return (
        <aside className="right-panel-ui">
            <div>
                <SmartAttendanceCard variant="sidebar" data={attendanceData} />
            </div>

            <div>
                <div className="rp-section-title">{t('quickGlanceTitle')}</div>
                <div className="glance-grid">
                    {quickGlance.length === 0 && (
                        <div className="panel-empty">{t('noDataYet')}</div>
                    )}
                    {quickGlance.map((item) => (
                        <div key={item.id} className={`glance-card tone-${item.color}`}>
                            <div className="glance-label">{item.label}</div>
                            <div className="glance-value">{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="rp-section-title">{t('pendingRequestsTitle')}</div>
                <div className="summary-grid">
                    {pendingStats.length === 0 && (
                        <div className="panel-empty">{t('noPendingRequests')}</div>
                    )}
                    {pendingStats.map((item) => (
                        <div key={item.id} className={`summary-row tone-${item.color}`}>
                            <span className="summary-label">{item.label}</span>
                            <span className="summary-value">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="rp-section-title">{t('todayEventsTitle')}</div>
                <div className="today-list">
                    {todayItems.map((item) => (
                        <div key={item.id} className={`today-item tone-${item.color}`}>
                            {item.time && <div className="ti-time">{item.time}</div>}
                            <div>
                                <div className="ti-name">{item.name}</div>
                                <div className="ti-type">{item.type}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="rp-section-title">{t('awaitingApprovalTitle')}</div>
                <div className="pend-list">
                    {approvalItems.length === 0 && (
                        <div className="panel-empty">{t('noAwaitingApproval')}</div>
                    )}
                    {approvalItems.map((item) => (
                        <div key={item.id}>
                            <div className="pend-item">
                                <div className={`pend-av tone-${item.color}`}>{item.name.slice(0, 2)}</div>
                                <div>
                                    <div className="pend-name">{item.name}</div>
                                    <div className="pend-type">{item.type}</div>
                                </div>
                                <span className="pend-tag">{t('pendingTag')}</span>
                            </div>
                            <div className="action-row">
                                <button className="act-btn approve" type="button">{t('approveLabel')}</button>
                                <button className="act-btn reject" type="button">{t('rejectLabel')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="rp-section-title">{t('deductionsPanelTitle')}</div>
                <div className="summary-list">
                    {deductionStats.length === 0 && (
                        <div className="panel-empty">{t('noDeductions')}</div>
                    )}
                    {deductionStats.map((item) => (
                        <div key={item.id} className={`summary-row tone-${item.color}`}>
                            <span className="summary-label">{item.label}</span>
                            <span className="summary-value">{item.value}</span>
                        </div>
                    ))}
                </div>
                {deductionHint && <div className="panel-hint">{deductionHint}</div>}
            </div>
        </aside>
    );
}
