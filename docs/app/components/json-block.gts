import type { TOC } from '@ember/component/template-only';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const JsonBlock: TOC<{ Element: HTMLElement; Args: { value: unknown } }> =
  <template>
    <pre class="json" ...attributes><code>{{pretty @value}}</code></pre>
  </template>;

export default JsonBlock;
