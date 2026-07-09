import { StubAdapter } from './_stub-adapter';

export class CuglPricesAdapter extends StubAdapter {
  sourceKey = 'cugl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
}
