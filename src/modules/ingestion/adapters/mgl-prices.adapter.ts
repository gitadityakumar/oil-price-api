import { StubAdapter } from './_stub-adapter';

export class MglPricesAdapter extends StubAdapter {
  sourceKey = 'mgl_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
}
