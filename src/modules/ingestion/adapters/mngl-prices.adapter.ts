import { CgdFixtureAdapter } from './_cgd-fixture-adapter';

export class MnglPricesAdapter extends CgdFixtureAdapter {
  sourceKey = 'mngl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
  liveUrl = 'https://www.mngl.in/our-services/check-rates';
  override capabilities = { fixture: true, live: false, allowedHosts: ['mngl.in', 'www.mngl.in'] } as const;
}