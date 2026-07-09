import { StubAdapter } from './_stub-adapter';

export class BpclRetailAdapter extends StubAdapter {
  sourceKey = 'bpcl_retail' as const;
  sourceType = 'omc' as const;
  mode = 'primary' as const;
}
