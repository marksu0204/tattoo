import { describe, expect, it } from 'vitest';

import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';

import { buildLineInquiryUrl, shouldShowPublicBookingCalendar } from './brandContact';

import { buildBookingDateInquiryMessageForArtwork } from './contactInquiry';

import { getBookingCtaCopy, resolveBookingCtaAction } from './resolveBookingCtaAction';



const readyLoggedOut = {

  liffEnvironmentReady: true,

  isLiffLoggedIn: false,

  hasValidLineAccessToken: false,

};



describe('resolveBookingCtaAction', () => {

  it('booking capability=false → hidden', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: false,

      liffEnvironmentReady: false,

      isLiffLoggedIn: true,

      hasValidLineAccessToken: true,

    })).toBe('hidden');

  });



  it('capability=true isReady=false → checking', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      liffEnvironmentReady: false,

      isLiffLoggedIn: false,

      hasValidLineAccessToken: false,

    })).toBe('checking');

  });



  it('isReady=false → checking copy disabled (no LINE / calendar destination)', () => {

    const copy = getBookingCtaCopy('checking');

    expect(copy?.title).toBe('確認登入狀態中…');

    expect(copy?.disabled).toBe(true);

  });



  it('isReady=true loggedIn=true → calendar', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      liffEnvironmentReady: true,

      isLiffLoggedIn: true,

      hasValidLineAccessToken: false,

    })).toBe('calendar');

  });



  it('isReady=true loggedIn=false token=false → line', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      ...readyLoggedOut,

    })).toBe('line');

  });



  it('external isLoggedIn=false user=null → line', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      ...readyLoggedOut,

    })).toBe('line');

  });



  it('stale cached user + ready + loggedOut → line (regression)', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      ...readyLoggedOut,

    })).toBe('line');

  });



  it('external valid access token → calendar', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      liffEnvironmentReady: true,

      isLiffLoggedIn: false,

      hasValidLineAccessToken: true,

    })).toBe('calendar');

  });



  it('LIFF valid logged-in → calendar', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      liffEnvironmentReady: true,

      isLiffLoggedIn: true,

      hasValidLineAccessToken: true,

    })).toBe('calendar');

  });



  it('LIFF in-client but not logged in → line (not isInClient alone)', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: true,

      ...readyLoggedOut,

    })).toBe('line');

  });



  it('GUJIGUJI → hidden regardless of LIFF readiness', () => {

    expect(resolveBookingCtaAction({

      hasBookingCapability: false,

      liffEnvironmentReady: false,

      isLiffLoggedIn: false,

      hasValidLineAccessToken: false,

    })).toBe('hidden');

    expect(shouldShowPublicBookingCalendar(GUJIGUJI_CONFIG)).toBe(false);

  });



  it('line fallback uses WHITEHORN brand LINE + booking-date prefill', () => {
    const copy = getBookingCtaCopy('line');
    expect(copy?.title).toBe('詢問可預約日期');
    const message = buildBookingDateInquiryMessageForArtwork(
      { id: '1787042693519', title: '墨蛛', price: 6000, heightCm: 10 },
      WHITEHORN_CONFIG,
    );
    const url = buildLineInquiryUrl(message, WHITEHORN_CONFIG);
    expect(url).toContain('oaMessage');
    expect(url).toContain(encodeURIComponent('我想詢問可預約的日期'));
    expect(url).toContain(encodeURIComponent('https://inkflow.work/artwork/1787042693519'));
  });

});


