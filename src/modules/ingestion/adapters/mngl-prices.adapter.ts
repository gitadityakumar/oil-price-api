import { StubAdapter } from './_stub-adapter';

export class MnglPricesAdapter extends StubAdapter {
  sourceKey = 'mngl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
}
