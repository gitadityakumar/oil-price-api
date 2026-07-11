import { CgdFixtureAdapter } from './_cgd-fixture-adapter';

export class MglPricesAdapter extends CgdFixtureAdapter {
  sourceKey = 'mgl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
  liveUrl = 'https://www.mahanagargas.com/cng/customer-zone/cng-rate-card';
  override capabilities = { fixture: true, live: false, allowedHosts: ['mahanagargas.com', 'www.mahanagargas.com'] } as const;
}