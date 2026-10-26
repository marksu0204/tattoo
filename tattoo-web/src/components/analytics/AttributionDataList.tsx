import React, { useCallback, useState } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import type { AnalyticsV2CampaignRow, AnalyticsV2ContentRow, AnalyticsV2SourceRow } from '../../types';
import { ComparisonStatus } from '../../utils/analyticsComparison';
import { ANALYTICS_MIN_SAMPLE_SESSIONS, isFunnelLowSample } from '../../utils/analyticsAttribution';
import { ComparisonMetricBlock } from './ComparisonMetricBlock';

const toNumber = (value: number): string => value.toLocaleString('zh-TW');
const toPercent = (value: number, digits = 1): string => `${(value * 100).toFixed(digits)}%`;

type ConversionMetrics = {
  sessions: number;
  viewSessions: number;
  leadSessions: number;
  leadRate: number;
  viewToLeadRate: number;
  bookingCompleteSessions: number;
  bookingRate: number;
  views: number;
  favAdds: number;
  uniqueContactSessions: number;
  lineContacts: number;
  instagramContacts: number;
  sessionContactRate: number;
  sessionFavoriteRate: number;
  uniqueViewSessions?: number;
};

const LowSampleBadge: React.FC<{ sessions: number }> = ({ sessions }) => {
  if (!isFunnelLowSample(sessions)) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700/30">
      樣本較少
    </span>
  );
};

const MetricCell: React.FC<{
  label?: string;
  value: React.ReactNode;
  compareActive: boolean;
  comparisonStatus: ComparisonStatus;
  current: number;
  previous: number | undefined;
  kind: 'count' | 'rate';
  formatValue?: (value: number) => string;
  align?: 'left' | 'center';
  sampleSessions?: number;
}> = ({ label, value, compareActive, comparisonStatus, current, previous, kind, formatValue, align = 'center', sampleSessions }) => (
  <div className={align === 'center' ? 'text-center' : ''}>
    {label && <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>}
    <div className={kind === 'rate' ? 'flex items-center justify-center gap-1 flex-wrap' : ''}>
      <span className="text-white text-sm">{value}</span>
      {kind === 'rate' && sampleSessions !== undefined && <LowSampleBadge sessions={sampleSessions} />}
    </div>
    <ComparisonMetricBlock
      enabled={compareActive}
      status={comparisonStatus}
      current={current}
      previous={previous}
      kind={kind}
      formatValue={formatValue}
    />
  </div>
);

const DetailGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
    {children}
  </div>
);

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
    <p className="text-[10px] text-gray-500">{label}</p>
    <p className="text-sm text-gray-200 mt-0.5">{value}</p>
  </div>
);

type SourceListProps = {
  rows: AnalyticsV2SourceRow[];
  getPrevious: (row: AnalyticsV2SourceRow) => ConversionMetrics | undefined;
  compareActive: boolean;
  comparisonStatus: ComparisonStatus;
  renderNameCell: (row: AnalyticsV2SourceRow) => React.ReactNode;
  onDrillCampaign: (source: string) => void;
};

export const SourceAttributionList: React.FC<SourceListProps> = ({
  rows,
  getPrevious,
  compareActive,
  comparisonStatus,
  renderNameCell,
  onDrillCampaign,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderDetail = (row: AnalyticsV2SourceRow, previous: ConversionMetrics | undefined) => (
    <DetailGrid>
      <DetailItem label="View Sessions" value={toNumber(row.viewSessions)} />
      <DetailItem label="View → Lead" value={toPercent(row.viewToLeadRate, 2)} />
      <DetailItem label="瀏覽" value={toNumber(row.views)} />
      <DetailItem label="收藏" value={toNumber(row.favAdds)} />
      <DetailItem label="詢問 Session" value={toNumber(row.uniqueContactSessions)} />
      <DetailItem label="LINE" value={toNumber(row.lineContacts)} />
      <DetailItem label="Instagram" value={toNumber(row.instagramContacts)} />
      <DetailItem label="詢問率" value={toPercent(row.sessionContactRate, 2)} />
      <DetailItem label="Session 收藏率" value={toPercent(row.sessionFavoriteRate, 2)} />
      <DetailItem label="Booking Sessions" value={toNumber(row.bookingCompleteSessions)} />
      <DetailItem label="Booking Rate" value={toPercent(row.bookingRate, 2)} />
      <DetailItem
        label="Raw UTM"
        value={<span className="break-all text-[11px]">{(row.rawSources ?? [row.source]).join(', ')}</span>}
      />
      {row.note && <DetailItem label="Note" value={row.note} />}
      {compareActive && previous && (
        <>
          <DetailItem label="比較期 Sessions" value={toNumber(previous.sessions)} />
          <DetailItem label="比較期 Lead Sessions" value={toNumber(previous.leadSessions)} />
          <DetailItem label="比較期 Lead Rate" value={toPercent(previous.leadRate, 2)} />
        </>
      )}
    </DetailGrid>
  );

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-dark text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-3 py-3">來源</th>
              <th className="px-3 py-3 text-center">Sessions</th>
              <th className="px-3 py-3 text-center">Lead Sessions</th>
              <th className="px-3 py-3 text-center">Lead Rate</th>
              <th className="px-3 py-3 text-center">Booking Sess.</th>
              <th className="px-3 py-3 text-center">Booking Rate</th>
              <th className="px-3 py-3 text-center w-24">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => {
              const key = row.source;
              const previous = getPrevious(row);
              const expanded = expandedKeys.has(key);
              return (
                <React.Fragment key={`source-${key}`}>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2">{renderNameCell(row)}</td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={toNumber(row.sessions)}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.sessions}
                        previous={previous?.sessions}
                        kind="count"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={<span className="text-primary">{toNumber(row.leadSessions)}</span>}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.leadSessions}
                        previous={previous?.leadSessions}
                        kind="count"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={toPercent(row.leadRate, 2)}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.leadRate}
                        previous={previous?.leadRate}
                        kind="rate"
                        formatValue={(v) => toPercent(v, 2)}
                        sampleSessions={row.sessions}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={<span className="text-emerald-300">{toNumber(row.bookingCompleteSessions)}</span>}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.bookingCompleteSessions}
                        previous={previous?.bookingCompleteSessions}
                        kind="count"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={toPercent(row.bookingRate, 2)}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.bookingRate}
                        previous={previous?.bookingRate}
                        kind="rate"
                        formatValue={(v) => toPercent(v, 2)}
                        sampleSessions={row.sessions}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        詳細 <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-black/20">
                      <td colSpan={7} className="px-3 py-3 space-y-3">
                        {renderDetail(row, previous)}
                        <button
                          type="button"
                          onClick={() => onDrillCampaign(row.source)}
                          className="text-xs text-primary hover:underline"
                        >
                          查看 Campaign
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-800">
        {rows.map((row) => {
          const key = row.source;
          const previous = getPrevious(row);
          const expanded = expandedKeys.has(key);
          return (
            <div key={`source-mobile-${key}`} className="p-3 space-y-3">
              {renderNameCell(row)}
              <div className="grid grid-cols-3 gap-2">
                <MetricCell
                  label="Sessions"
                  value={toNumber(row.sessions)}
                  compareActive={compareActive}
                  comparisonStatus={comparisonStatus}
                  current={row.sessions}
                  previous={previous?.sessions}
                  kind="count"
                  align="left"
                />
                <MetricCell
                  label="Lead"
                  value={toNumber(row.leadSessions)}
                  compareActive={compareActive}
                  comparisonStatus={comparisonStatus}
                  current={row.leadSessions}
                  previous={previous?.leadSessions}
                  kind="count"
                  align="left"
                />
                <MetricCell
                  label="Lead Rate"
                  value={toPercent(row.leadRate, 2)}
                  compareActive={compareActive}
                  comparisonStatus={comparisonStatus}
                  current={row.leadRate}
                  previous={previous?.leadRate}
                  kind="rate"
                  formatValue={(v) => toPercent(v, 2)}
                  align="left"
                />
              </div>
              <button
                type="button"
                onClick={() => toggle(key)}
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {expanded ? '收合詳細' : '詳細'} <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
              </button>
              {expanded && renderDetail(row, previous)}
            </div>
          );
        })}
      </div>
    </>
  );
};

type CampaignListProps = {
  rows: AnalyticsV2CampaignRow[];
  getPrevious: (row: AnalyticsV2CampaignRow) => ConversionMetrics | undefined;
  compareActive: boolean;
  comparisonStatus: ComparisonStatus;
  renderNameCell: (row: AnalyticsV2CampaignRow) => React.ReactNode;
  getSourceLabel: (source: string) => string;
  onDrillContent: (source: string, campaign: string | null) => void;
  onCopyUtm: (key: string, text: string) => void;
  copiedUtmKey: string | null;
};

export const CampaignAttributionList: React.FC<CampaignListProps> = ({
  rows,
  getPrevious,
  compareActive,
  comparisonStatus,
  renderNameCell,
  getSourceLabel,
  onDrillContent,
  onCopyUtm,
  copiedUtmKey,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderDetail = (row: AnalyticsV2CampaignRow, previous: ConversionMetrics | undefined, rowKey: string, utmText: string) => (
    <DetailGrid>
      <DetailItem label="Source" value={getSourceLabel(row.source)} />
      <DetailItem label="View Sessions" value={toNumber(row.viewSessions)} />
      <DetailItem label="View → Lead" value={toPercent(row.viewToLeadRate, 2)} />
      <DetailItem label="瀏覽" value={toNumber(row.views)} />
      <DetailItem label="收藏" value={toNumber(row.favAdds)} />
      <DetailItem label="詢問 Session" value={toNumber(row.uniqueContactSessions)} />
      <DetailItem label="LINE" value={toNumber(row.lineContacts)} />
      <DetailItem label="Instagram" value={toNumber(row.instagramContacts)} />
      <DetailItem label="Booking Sessions" value={toNumber(row.bookingCompleteSessions)} />
      <DetailItem label="Booking Rate" value={toPercent(row.bookingRate, 2)} />
      {row.note && <DetailItem label="Note" value={row.note} />}
      <DetailItem
        label="Raw UTM"
        value={
          <button
            type="button"
            onClick={() => onCopyUtm(`campaign-${rowKey}`, utmText)}
            className="text-[11px] text-gray-300 hover:text-white inline-flex items-center gap-1 break-all text-left"
          >
            <Copy size={11} /> {copiedUtmKey === `campaign-${rowKey}` ? '已複製' : utmText.replace(/\n/g, ' · ')}
          </button>
        }
      />
      {compareActive && previous && (
        <>
          <DetailItem label="比較期 Sessions" value={toNumber(previous.sessions)} />
          <DetailItem label="比較期 Lead Sessions" value={toNumber(previous.leadSessions)} />
        </>
      )}
    </DetailGrid>
  );

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-dark text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Campaign</th>
              <th className="px-3 py-3 text-center">Sessions</th>
              <th className="px-3 py-3 text-center">Lead Sessions</th>
              <th className="px-3 py-3 text-center">Lead Rate</th>
              <th className="px-3 py-3 text-center">Booking Sess.</th>
              <th className="px-3 py-3 text-center">Booking Rate</th>
              <th className="px-3 py-3 text-center w-24">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => {
              const rowKey = `${row.source}::${row.campaign ?? ''}`;
              const previous = getPrevious(row);
              const expanded = expandedKeys.has(rowKey);
              const utmText = `utm_source=${row.source}\nutm_campaign=${row.campaign ?? ''}`;
              return (
                <React.Fragment key={`campaign-${rowKey}`}>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 text-white text-sm">{getSourceLabel(row.source)}</td>
                    <td className="px-3 py-2">{renderNameCell(row)}</td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={toNumber(row.sessions)}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.sessions}
                        previous={previous?.sessions}
                        kind="count"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={<span className="text-primary">{toNumber(row.leadSessions)}</span>}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.leadSessions}
                        previous={previous?.leadSessions}
                        kind="count"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={toPercent(row.leadRate, 2)}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.leadRate}
                        previous={previous?.leadRate}
                        kind="rate"
                        formatValue={(v) => toPercent(v, 2)}
                        sampleSessions={row.sessions}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={<span className="text-emerald-300">{toNumber(row.bookingCompleteSessions)}</span>}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.bookingCompleteSessions}
                        previous={previous?.bookingCompleteSessions}
                        kind="count"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell
                        value={toPercent(row.bookingRate, 2)}
                        compareActive={compareActive}
                        comparisonStatus={comparisonStatus}
                        current={row.bookingRate}
                        previous={previous?.bookingRate}
                        kind="rate"
                        formatValue={(v) => toPercent(v, 2)}
                        sampleSessions={row.sessions}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => toggle(rowKey)} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                        詳細 <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-black/20">
                      <td colSpan={8} className="px-3 py-3 space-y-3">
                        {renderDetail(row, previous, rowKey, utmText)}
                        <button type="button" onClick={() => onDrillContent(row.source, row.campaign)} className="text-xs text-primary hover:underline">
                          查看素材
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-800">
        {rows.map((row) => {
          const rowKey = `${row.source}::${row.campaign ?? ''}`;
          const previous = getPrevious(row);
          const expanded = expandedKeys.has(rowKey);
          const utmText = `utm_source=${row.source}\nutm_campaign=${row.campaign ?? ''}`;
          return (
            <div key={`campaign-mobile-${rowKey}`} className="p-3 space-y-3">
              <p className="text-xs text-gray-500">{getSourceLabel(row.source)}</p>
              {renderNameCell(row)}
              <div className="grid grid-cols-3 gap-2">
                <MetricCell label="Sessions" value={toNumber(row.sessions)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.sessions} previous={previous?.sessions} kind="count" align="left" />
                <MetricCell label="Lead" value={toNumber(row.leadSessions)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.leadSessions} previous={previous?.leadSessions} kind="count" align="left" />
                <MetricCell label="Lead Rate" value={toPercent(row.leadRate, 2)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.leadRate} previous={previous?.leadRate} kind="rate" formatValue={(v) => toPercent(v, 2)} align="left" />
              </div>
              <button type="button" onClick={() => toggle(rowKey)} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                {expanded ? '收合詳細' : '詳細'} <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
              </button>
              {expanded && renderDetail(row, previous, rowKey, utmText)}
            </div>
          );
        })}
      </div>
    </>
  );
};

type ContentListProps = {
  rows: AnalyticsV2ContentRow[];
  getPrevious: (row: AnalyticsV2ContentRow) => ConversionMetrics | undefined;
  compareActive: boolean;
  comparisonStatus: ComparisonStatus;
  renderNameCell: (row: AnalyticsV2ContentRow) => React.ReactNode;
  getSourceLabel: (source: string) => string;
  getCampaignLabel: (row: AnalyticsV2ContentRow) => string;
  renderTags: (row: AnalyticsV2ContentRow) => React.ReactNode;
  onCopyUtm: (key: string, text: string) => void;
  copiedUtmKey: string | null;
};

export const ContentAttributionList: React.FC<ContentListProps> = ({
  rows,
  getPrevious,
  compareActive,
  comparisonStatus,
  renderNameCell,
  getSourceLabel,
  getCampaignLabel,
  renderTags,
  onCopyUtm,
  copiedUtmKey,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderDetail = (row: AnalyticsV2ContentRow, previous: ConversionMetrics | undefined, rowKey: string, utmText: string) => (
    <DetailGrid>
      <DetailItem label="Source" value={getSourceLabel(row.source)} />
      <DetailItem label="Campaign" value={getCampaignLabel(row)} />
      <DetailItem label="View Sessions" value={toNumber(row.viewSessions)} />
      <DetailItem label="View → Lead" value={toPercent(row.viewToLeadRate, 2)} />
      <DetailItem label="瀏覽" value={toNumber(row.views)} />
      <DetailItem label="收藏" value={toNumber(row.favAdds)} />
      <DetailItem label="詢問 Session" value={toNumber(row.uniqueContactSessions)} />
      <DetailItem label="LINE" value={toNumber(row.lineContacts)} />
      <DetailItem label="Instagram" value={toNumber(row.instagramContacts)} />
      <DetailItem label="Booking Sessions" value={toNumber(row.bookingCompleteSessions)} />
      <DetailItem label="Booking Rate" value={toPercent(row.bookingRate, 2)} />
      {row.note && <DetailItem label="Note" value={row.note} />}
      <DetailItem label="標籤" value={renderTags(row)} />
      <DetailItem
        label="Raw UTM"
        value={
          <button
            type="button"
            onClick={() => onCopyUtm(`content-${rowKey}`, utmText)}
            className="text-[11px] text-gray-300 hover:text-white inline-flex items-center gap-1 break-all text-left"
          >
            <Copy size={11} /> {copiedUtmKey === `content-${rowKey}` ? '已複製' : utmText.replace(/\n/g, ' · ')}
          </button>
        }
      />
      {compareActive && previous && (
        <>
          <DetailItem label="比較期 Sessions" value={toNumber(previous.sessions)} />
          <DetailItem label="比較期 Lead Sessions" value={toNumber(previous.leadSessions)} />
        </>
      )}
    </DetailGrid>
  );

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-dark text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Campaign</th>
              <th className="px-3 py-3">Content</th>
              <th className="px-3 py-3 text-center">Sessions</th>
              <th className="px-3 py-3 text-center">Lead Sessions</th>
              <th className="px-3 py-3 text-center">Lead Rate</th>
              <th className="px-3 py-3 text-center">Booking Sess.</th>
              <th className="px-3 py-3 text-center">Booking Rate</th>
              <th className="px-3 py-3 text-center w-24">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => {
              const rowKey = `${row.source}::${row.campaign ?? ''}::${row.content ?? ''}`;
              const previous = getPrevious(row);
              const expanded = expandedKeys.has(rowKey);
              const utmText = `utm_source=${row.source}\nutm_campaign=${row.campaign ?? ''}\nutm_content=${row.content ?? ''}`;
              return (
                <React.Fragment key={`content-${rowKey}`}>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 text-white text-sm">{getSourceLabel(row.source)}</td>
                    <td className="px-3 py-2 text-white text-sm">{getCampaignLabel(row)}</td>
                    <td className="px-3 py-2">{renderNameCell(row)}</td>
                    <td className="px-3 py-2">
                      <MetricCell value={toNumber(row.sessions)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.sessions} previous={previous?.sessions} kind="count" />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell value={<span className="text-primary">{toNumber(row.leadSessions)}</span>} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.leadSessions} previous={previous?.leadSessions} kind="count" />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell value={toPercent(row.leadRate, 2)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.leadRate} previous={previous?.leadRate} kind="rate" formatValue={(v) => toPercent(v, 2)} sampleSessions={row.sessions} />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell value={<span className="text-emerald-300">{toNumber(row.bookingCompleteSessions)}</span>} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.bookingCompleteSessions} previous={previous?.bookingCompleteSessions} kind="count" />
                    </td>
                    <td className="px-3 py-2">
                      <MetricCell value={toPercent(row.bookingRate, 2)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.bookingRate} previous={previous?.bookingRate} kind="rate" formatValue={(v) => toPercent(v, 2)} sampleSessions={row.sessions} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => toggle(rowKey)} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                        詳細 <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-black/20">
                      <td colSpan={9} className="px-3 py-3">{renderDetail(row, previous, rowKey, utmText)}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-800">
        {rows.map((row) => {
          const rowKey = `${row.source}::${row.campaign ?? ''}::${row.content ?? ''}`;
          const previous = getPrevious(row);
          const expanded = expandedKeys.has(rowKey);
          const utmText = `utm_source=${row.source}\nutm_campaign=${row.campaign ?? ''}\nutm_content=${row.content ?? ''}`;
          return (
            <div key={`content-mobile-${rowKey}`} className="p-3 space-y-3">
              <p className="text-xs text-gray-500">{getSourceLabel(row.source)} / {getCampaignLabel(row)}</p>
              {renderNameCell(row)}
              <div className="grid grid-cols-3 gap-2">
                <MetricCell label="Sessions" value={toNumber(row.sessions)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.sessions} previous={previous?.sessions} kind="count" align="left" />
                <MetricCell label="Lead" value={toNumber(row.leadSessions)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.leadSessions} previous={previous?.leadSessions} kind="count" align="left" />
                <MetricCell label="Lead Rate" value={toPercent(row.leadRate, 2)} compareActive={compareActive} comparisonStatus={comparisonStatus} current={row.leadRate} previous={previous?.leadRate} kind="rate" formatValue={(v) => toPercent(v, 2)} align="left" />
              </div>
              <button type="button" onClick={() => toggle(rowKey)} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                {expanded ? '收合詳細' : '詳細'} <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
              </button>
              {expanded && renderDetail(row, previous, rowKey, utmText)}
            </div>
          );
        })}
      </div>
    </>
  );
};

export { ANALYTICS_MIN_SAMPLE_SESSIONS };
