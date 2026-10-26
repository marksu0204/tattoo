import React, { useMemo, useState } from 'react';
import type { MetaDemographicDetail } from '../types';
import { aggregateMetaDemographics, demographicCsvCell, demographicMetrics, type DemographicGrouping } from '../utils/metaDemographics';
const format = (value: number | null) => value === null ? '—' : value.toLocaleString('zh-TW',{maximumFractionDigits:2});
export default function MetaDemographicsPanel({data}: {data: {available:boolean; rows:MetaDemographicDetail[]}}) {
  const [grouping,setGrouping] = useState<DemographicGrouping>('age');
  const [filters,setFilters] = useState({campaign_id:'',adset_id:'',ad_id:'',currency:''});
  const rows = useMemo(() => data.rows.filter(r => Object.entries(filters).every(([key,value]) => !value || (r[key as keyof typeof filters] ?? '未提供') === value)),[data.rows,filters]);
  const aggregate = useMemo(() => aggregateMetaDemographics(rows,grouping),[rows,grouping]);
  const exportCsv = () => {
    const fields: (keyof MetaDemographicDetail)[] = ['date','account_id','campaign_id','campaign_name','adset_id','adset_name','ad_id','ad_name','age_range','gender','currency','timezone',...demographicMetrics];
    const csv = [[...fields,'ctr','cost_per_lpv'].map(demographicCsvCell).join(','),...rows.map(row => {
      const derived = aggregateMetaDemographics([row],'ageGender')[0];
      return [...fields.map(field => row[field]),derived.ctr,derived.costPerLpv].map(demographicCsvCell).join(',');
    })].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='meta-demographics.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  return <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-4">
    <h3 className="text-white font-semibold">人口統計 · Meta 回報人口統計</h3>
    <p className="text-sm text-gray-400">年齡與性別來自 Meta 廣告報表，INKFLOW 本身不蒐集網站訪客的年齡或性別。</p>
    <p className="text-xs text-gray-500">沿用上方日期。以下篩選只影響 Meta 人口統計，不包含 INKFLOW 站內事件。Reach 為各列加總，跨日／廣告未去重；含缺值的總計與比率顯示 —，不把空白當零。不同幣別混合時不顯示花費與成本。</p>
    {!data.available ? <p className="text-amber-300">人口統計資料表尚未建立。</p> : <>
      <div className="flex flex-wrap gap-2">
        <select aria-label="人口統計分析方式" value={grouping} onChange={e=>setGrouping(e.target.value as DemographicGrouping)} className="bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"><option value="age">年齡分析</option><option value="gender">性別分析</option><option value="ageGender">年齡 × 性別</option><option value="campaign">活動 × 人口統計</option><option value="ad">廣告 × 人口統計</option></select>
        {(['campaign_id','adset_id','ad_id','currency'] as const).map(field => <select key={field} aria-label={`人口統計${field}`} value={filters[field]} onChange={e=>setFilters(prev=>({...prev,[field]:e.target.value}))} className="max-w-full sm:max-w-60 bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-200"><option value="">全部{{campaign_id:'活動',adset_id:'廣告組合',ad_id:'廣告',currency:'幣別'}[field]}</option>{[...new Map(data.rows.map(r=>[r[field] ?? '未提供',field==='currency' ? r.currency : r[field==='campaign_id'?'campaign_name':field==='adset_id'?'adset_name':'ad_name']])).entries()].map(([id,name])=><option key={id} value={id}>{name || id}{name && field!=='currency' ? ` (${id})` : ''}</option>)}</select>)}
        <button type="button" disabled={!rows.length} onClick={exportCsv} className="border border-gray-700 rounded px-3 text-sm text-gray-200 disabled:opacity-40">匯出 Demographic CSV</button>
      </div>
      <p className="text-xs text-gray-400">{rows.length} 筆 Meta 明細 · 幣別：{[...new Set(rows.map(r=>r.currency ?? '未提供'))].join('、') || '—'}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="text-gray-400"><tr>{['區間','花費','花費占比','曝光','Reach（加總）','全部點擊','連結點擊','連外點擊','Link CTR','LPV','CPC（連結）','Cost per LPV'].map(label=><th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody className="text-gray-200">{aggregate.map(row=><tr key={row.key} className="border-t border-gray-800"><td className="p-2 max-w-80 truncate" title={row.label}>{row.label}</td>{[row.spend,row.spendShare,row.impressions,row.reach,row.clicks_all,row.link_clicks,row.outbound_clicks,row.ctr,row.landing_page_views,row.costPerLinkClick,row.costPerLpv].map((value,i)=><td key={i} className="p-2 tabular-nums">{format(value)}{value!==null && (i===1 || i===7)?'%':''}</td>)}</tr>)}{!aggregate.length && <tr><td colSpan={12} className="p-4 text-gray-500">此範圍尚無 Meta 人口統計資料。</td></tr>}</tbody></table></div>
    </>}
  </section>;
}
