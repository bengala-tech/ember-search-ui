import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';

const prev = (page: number) => page - 1;
const next = (page: number) => page + 1;
const isFirst = (page: number) => page <= 1;
const isLast = (page: number, count: number) => page >= count;

const Pager: TOC<{
  Args: {
    page: number;
    pageCount: number;
    total: number;
    onChange: (page: number) => void;
  };
}> = <template>
  <nav class="pager" aria-label="Pages">
    <button
      type="button"
      data-test-prev
      disabled={{isFirst @page}}
      {{on "click" (fn @onChange (prev @page))}}
    >‹ Previous</button>
    <span data-test-page>Page
      {{@page}}
      of
      {{if @pageCount @pageCount 1}}
      ·
      {{@total}}
      inspections</span>
    <button
      type="button"
      data-test-next
      disabled={{isLast @page @pageCount}}
      {{on "click" (fn @onChange (next @page))}}
    >Next ›</button>
  </nav>
</template>;

export default Pager;
