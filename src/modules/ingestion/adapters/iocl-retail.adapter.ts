import { StubAdapter } from './_stub-adapter';

export class IoclRetailAdapter extends StubAdapter {
  sourceKey = 'iocl_retail' as const;
  sourceType = 'omc' as const;
  mode = 'primary' as const;
}
