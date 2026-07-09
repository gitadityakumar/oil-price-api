import type { SourceAdapter } from './source-adapter';
import { PpacRspAdapter } from './adapters/ppac-rsp.adapter';
import { IglPricesAdapter } from './adapters/igl-prices.adapter';
import { IoclRetailAdapter } from './adapters/iocl-retail.adapter';
import { BpclRetailAdapter } from './adapters/bpcl-retail.adapter';
import { HpclRetailAdapter } from './adapters/hpcl-retail.adapter';
import { GujaratGasAdapter } from './adapters/gujarat-gas.adapter';
import { MglPricesAdapter } from './adapters/mgl-prices.adapter';
import { MnglPricesAdapter } from './adapters/mngl-prices.adapter';
import { CuglPricesAdapter } from './adapters/cugl-prices.adapter';

const adapters: SourceAdapter[] = [
  new PpacRspAdapter(),
  new IglPricesAdapter(),
  new IoclRetailAdapter(),
  new BpclRetailAdapter(),
  new HpclRetailAdapter(),
  new GujaratGasAdapter(),
  new MglPricesAdapter(),
  new MnglPricesAdapter(),
  new CuglPricesAdapter(),
];

export function getSourceAdapter(sourceKey: string): SourceAdapter | null {
  return adapters.find((adapter) => adapter.sourceKey === sourceKey) ?? null;
}

export function listSourceAdapters(): SourceAdapter[] {
  return [...adapters];
}
