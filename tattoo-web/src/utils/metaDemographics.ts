import type { MetaDemographicDetail } from '../types';
export const demographicMetrics = ['spend','impressions','reach','clicks_all','link_clicks','outbound_clicks','landing_page_views'] as const;
export type DemographicGrouping = 'age' | 'gender' | 'ageGender' | 'campaign' | 'ad';
export function aggregateMetaDemographics(rows: MetaDemographicDetail[], grouping: DemographicGrouping) {
  const groups = new Map<string, {label: string; rows: MetaDemographicDetail[]}>();
  const mixedCurrency = new Set(rows.map(r => r.currency)).size > 1;
  const totalSpend = rows.some(r => r.spend === null) || mixedCurrency ? null : rows.reduce((sum,r) => sum + Number(r.spend),0);
  for (const row of rows) {
    const population = `${row.age_range} · ${row.gender}`;
    const identity = grouping === 'campaign' ? row.campaign_id : grouping === 'ad' ? row.ad_id : null;
    const label = grouping === 'age' ? row.age_range : grouping === 'gender' ? row.gender : grouping === 'campaign' ? `${row.campaign_name || identity || '未提供活動'} · ${population}` : grouping === 'ad' ? `${row.ad_name || identity} · ${population}` : population;
    const key = JSON.stringify([identity,grouping === 'gender' ? null : row.age_range,grouping === 'age' ? null : row.gender]);
    const group = groups.get(key) ?? {label, rows: []}; group.rows.push(row); groups.set(key,group);
  }
  return [...groups.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([key,group]) => {
    const sum = (field: typeof demographicMetrics[number]): number | null => group.rows.some(r => r[field] === null) || (field === 'spend' && mixedCurrency) ? null : group.rows.reduce((total,r) => total + Number(r[field]),0);
    const values = Object.fromEntries(demographicMetrics.map(field => [field,sum(field)])) as Record<typeof demographicMetrics[number], number | null>;
    const divide = (n: number | null,d: number | null,scale=1) => n !== null && d !== null && d > 0 ? n/d*scale : null;
    return {key,label:group.label,...values,ctr:divide(values.link_clicks,values.impressions,100),costPerLinkClick:divide(values.spend,values.link_clicks),costPerLpv:divide(values.spend,values.landing_page_views),spendShare:divide(values.spend,totalSpend,100)};
  });
}
export function demographicCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g,'""') + '"';
}
