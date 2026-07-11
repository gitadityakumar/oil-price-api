import { CgdFixtureAdapter } from './_cgd-fixture-adapter';

export class GujaratGasAdapter extends CgdFixtureAdapter {
  sourceKey = 'gujarat_gas_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
  liveUrl = 'https://www.gujaratgas.com/check-gas-price/';
  override capabilities = { fixture: true, live: false, allowedHosts: ['gujaratgas.com', 'www.gujaratgas.com'] } as const;
}