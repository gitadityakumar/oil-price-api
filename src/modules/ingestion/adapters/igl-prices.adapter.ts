import { CgdFixtureAdapter } from './_cgd-fixture-adapter';

export class IglPricesAdapter extends CgdFixtureAdapter {
  sourceKey = 'igl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
  liveUrl = 'https://www.iglonline.net/cng-png-prices';
  override capabilities = { fixture: true, live: false, allowedHosts: ['iglonline.net', 'www.iglonline.net'] } as const;
}