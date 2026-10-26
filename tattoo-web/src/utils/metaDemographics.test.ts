import { describe, expect, it } from 'vitest';
import type { MetaDemographicDetail } from '../types';
import { aggregateMetaDemographics, demographicCsvCell } from './metaDemographics';
const base: MetaDemographicDetail = { date:'2026-09-06',account_id:'a',campaign_id:'c',campaign_name:'Campaign',adset_id:'s',adset_name:'Set',ad_id:'ad',ad_name:'Ad',age_range:'25-34',gender:'female',currency:'USD',timezone:'America/Los_Angeles',spend:'1',impressions:'100',reach:90,clicks_all:20,link_clicks:10,outbound_clicks:8,landing_page_views:5 };
describe('Meta demographics',()=>{
  it('aggregates before deriving ratios',()=>{
    const result=aggregateMetaDemographics([base,{...base,spend:3,impressions:300,link_clicks:20,landing_page_views:5}],'age')[0];
    expect(result.spend).toBe(4); expect(result.ctr).toBe(7.5); expect(result.costPerLpv).toBe(.4); expect(result.spendShare).toBe(100);
  });
  it('retains unknown and separates demographic comparisons by id',()=>{
    const rows=[base,{...base,age_range:'unknown',gender:'unknown'},{...base,ad_id:'other'}];
    expect(aggregateMetaDemographics(rows,'ageGender')).toHaveLength(2); expect(aggregateMetaDemographics(rows,'ad')).toHaveLength(3);
  });
  it('does not turn missing or mixed-currency spend into a number',()=>{
    expect(aggregateMetaDemographics([base,{...base,spend:null}],'age')[0].spend).toBeNull();
    expect(aggregateMetaDemographics([base,{...base,currency:'TWD'}],'age')[0].costPerLpv).toBeNull();
    expect(aggregateMetaDemographics([{...base,impressions:0,landing_page_views:0}],'age')[0].ctr).toBeNull();
  });
  it('escapes CSV quotes and formula prefixes',()=>{
    expect(demographicCsvCell('=1+1')).toBe('"\'=1+1"'); expect(demographicCsvCell('a"b')).toBe('"a""b"'); expect(demographicCsvCell(null)).toBe('""');
  });
});
