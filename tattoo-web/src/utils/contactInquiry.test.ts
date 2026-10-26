import { describe, expect, it } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import { buildLineInquiryUrl } from './brandContact';
import {
  CUSTOM_INQUIRY_MESSAGE,
  buildArtworkInquiryMessage,
  buildArtworkInquirySummary,
  buildArtworkPublicUrl,
  buildBookingDateInquiryMessage,
  buildBookingDateInquiryMessageForArtwork,
} from './contactInquiry';

const sampleArtwork = {
  id: '1787042693519',
  title: '墨蛛',
  price: 6000,
  specialPrice: undefined as number | undefined,
  widthCm: undefined as number | undefined,
  heightCm: 10,
};

describe('contactInquiry booking-date message', () => {
  it('full artwork includes title, price, size, URL and booking closing line', () => {
    const message = buildBookingDateInquiryMessageForArtwork(sampleArtwork, WHITEHORN_CONFIG);

    expect(message).toContain('你好，我對這張圖有興趣：');
    expect(message).toContain('作品：墨蛛');
    expect(message).toContain('預估價格：NT$6,000');
    expect(message).toContain('建議尺寸：約高 10 cm');
    expect(message).toContain('作品連結：');
    expect(message).toContain('https://inkflow.work/artwork/1787042693519');
    expect(message).toContain('我想詢問可預約的日期');
  });

  it('omits size line when size is missing', () => {
    const message = buildBookingDateInquiryMessage({
      title: '墨蛛',
      priceLabel: 'NT$6,000',
      size: null,
      url: 'https://inkflow.work/artwork/1787042693519',
    });

    expect(message).not.toContain('建議尺寸：');
    expect(message).not.toContain('建議尺寸：\n');
  });

  it('omits price line when price is missing', () => {
    const message = buildBookingDateInquiryMessage({
      title: '墨蛛',
      priceLabel: null,
      size: '約高 10 cm',
      url: 'https://inkflow.work/artwork/1787042693519',
    });

    expect(message).not.toContain('預估價格：');
  });

  it('uses brand publicOrigin for artwork URL (WHITEHORN)', () => {
    const url = buildArtworkPublicUrl('1787042693519', WHITEHORN_CONFIG);
    expect(url).toBe('https://inkflow.work/artwork/1787042693519');
  });

  it('uses brand publicOrigin for artwork URL (GUJIGUJI)', () => {
    const url = buildArtworkPublicUrl('123', GUJIGUJI_CONFIG);
    expect(url).toBe('https://gujiguji.inkflow.work/artwork/123');
    expect(url).not.toBe('https://inkflow.work/artwork/123');
  });
});

describe('contactInquiry regression', () => {
  it('buildArtworkInquiryMessage keeps legacy claim inquiry format', () => {
    const message = buildArtworkInquiryMessage(
      { id: '1787042693519', title: '墨蛛' },
      'https://inkflow.work/artwork/1787042693519',
    );

    expect(message).toBe([
      '你好，我想詢問認領圖 1787042693519《墨蛛》。',
      '',
      '預計施作部位：',
      '希望尺寸：',
      '方便預約時間：',
      '',
      '作品網址：https://inkflow.work/artwork/1787042693519',
    ].join('\n'));
  });

  it('buildLineInquiryUrl encodes Chinese and URL in oaMessage', () => {
    const summary = buildArtworkInquirySummary({
      title: '墨蛛 & 測試',
      priceLabel: 'NT$6,000',
      size: '約高 10 cm',
      url: 'https://inkflow.work/artwork/1787042693519?ref=line',
    });
    const message = buildBookingDateInquiryMessage({
      title: '墨蛛 & 測試',
      priceLabel: 'NT$6,000',
      size: '約高 10 cm',
      url: 'https://inkflow.work/artwork/1787042693519?ref=line',
    });
    expect(message).toContain(summary);

    const url = buildLineInquiryUrl(message, WHITEHORN_CONFIG);
    expect(url).toContain('line.me/R/oaMessage/@');
    expect(url).toContain(encodeURIComponent(message));
    expect(url).toContain(encodeURIComponent('墨蛛 & 測試'));
  });
});


describe('custom inquiry', () => {
  it('opens the official account chat with the custom-tattoo template prefilled', () => {
    const url = buildLineInquiryUrl(CUSTOM_INQUIRY_MESSAGE, WHITEHORN_CONFIG);
    expect(url).toBe(`https://line.me/R/oaMessage/@270vwddw/?${encodeURIComponent(CUSTOM_INQUIRY_MESSAGE)}`);
    expect(CUSTOM_INQUIRY_MESSAGE).toContain('客製刺青');
    expect(CUSTOM_INQUIRY_MESSAGE).toContain('預計部位');
  });
});
