import { StubAdapter } from './_stub-adapter';

export class HpclRetailAdapter extends StubAdapter {
  sourceKey = 'hpcl_retail' as const;
  sourceType = 'omc' as const;
  mode = 'primary' as const;
}
