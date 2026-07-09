import { StubAdapter } from './_stub-adapter';

export class GujaratGasAdapter extends StubAdapter {
  sourceKey = 'gujarat_gas_prices' as const;
  sourceType = 'cgd' as const;
  mode = 'primary' as const;
}
