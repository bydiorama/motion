// The wizard page. The catalog and the library are inlined by `motion wizard`,
// so the page is one file that works offline and can be shared as is.
import type { Catalog } from '../catalog.ts';
import type { Library } from '../brief/types.ts';
import { createWizard } from './wizard.ts';

const data = JSON.parse(document.getElementById('wizard-data')!.textContent!) as { catalog: Catalog; library: Library };
(window as unknown as { motionWizard: unknown }).motionWizard = createWizard(document.getElementById('app')!, data);
