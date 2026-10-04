import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { SortItem } from 'ember-search-ui-driver';
import { userName, type Inspection } from '../demo/data.ts';

const COLUMNS = [
  { field: 'id', label: '#' },
  { field: 'title', label: 'Title' },
  { field: 'state', label: 'State' },
  { field: 'priority', label: 'Priority' },
  { field: 'project', label: 'Project' },
  { field: 'created_by_id', label: 'Created by' },
  { field: 'tags', label: 'Tags' },
  { field: 'cost', label: 'Cost' },
  { field: 'created_at', label: 'Created' },
  { field: 'due_at', label: 'Due' },
];

const sortMark = (sort: readonly SortItem[], field: string) => {
  const current = sort[0];
  if (current?.field !== field) return '';
  return current.direction === 'asc' ? '▲' : '▼';
};
const ariaSort = (sort: readonly SortItem[], field: string) => {
  const current = sort[0];
  if (current?.field !== field) return 'none';
  return current.direction === 'asc' ? 'ascending' : 'descending';
};
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');
const money = (n: number | undefined) =>
  n === undefined ? '—' : `$${n.toLocaleString('en')}`;
const join = (tags: string[]) => tags.join(', ');

interface Signature {
  Element: HTMLTableElement;
  Args: {
    results: readonly Inspection[];
    sort: readonly SortItem[];
    onSort: (field: string) => void;
    loading: boolean;
  };
}

const ResultsTable: TOC<Signature> = <template>
  <div class="table-scroll">
    <table class="results {{if @loading 'is-loading'}}" ...attributes>
      <thead>
        <tr>
          {{#each COLUMNS as |column|}}
            <th scope="col" aria-sort={{ariaSort @sort column.field}}>
              <button
                type="button"
                data-test-sort={{column.field}}
                {{on "click" (fn @onSort column.field)}}
              >
                {{column.label}}
                <span class="sort-mark">{{sortMark @sort column.field}}</span>
              </button>
            </th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each @results as |row|}}
          <tr data-test-row={{row.id}}>
            <td>{{row.id}}</td>
            <td>{{row.title}}</td>
            <td><span
                class="badge state-{{row.state}}"
              >{{row.state}}</span></td>
            <td>{{row.priority}}</td>
            <td>{{row.project}}</td>
            <td>{{userName row.created_by_id}}</td>
            <td>{{join row.tags}}</td>
            <td class="num">{{money row.cost}}</td>
            <td>{{day row.created_at}}</td>
            <td>{{day row.due_at}}</td>
          </tr>
        {{else}}
          <tr><td colspan="10" class="empty">No inspections match.</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</template>;

export default ResultsTable;
