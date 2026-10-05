import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { modifier } from 'ember-modifier';
import type Owner from '@ember/owner';
import {
  date,
  range,
  readPath,
  toProperties,
  type AnyProperty,
  type Property,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';
import { display } from './display.ts';

interface Signature {
  Args: {
    search: TrackedSearch<unknown>;
    properties: readonly AnyProperty<never, unknown>[];
    /** The first month shown, `YYYY-MM`. */
    month: string;
  };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Changes the search while the calendar is on the page. A modifier, so the
 * changes happen after rendering, not while the page reads the state.
 */
const ownsMonth = modifier<{
  Args: { Positional: [{ attach: () => void; detach: () => void }] };
}>((_element, [calendar]) => {
  calendar.attach();
  return () => calendar.detach();
});

interface Day {
  key: string;
  number: number;
  inMonth: boolean;
}

/**
 * A month grid on the property marked `views.calendar.date`. It narrows the
 * search to the visible month with a scope, which leaves the user's
 * filters alone and goes away with the calendar.
 */
export default class PropertyCalendar extends Component<Signature> {
  @tracked year: number;
  @tracked month: number; // 1-12
  #perPage: number | undefined;

  constructor(owner: Owner, args: Signature['Args']) {
    super(owner, args);
    const [year, month] = args.month.split('-').map(Number);
    this.year = year!;
    this.month = month!;
    const page = args.search.driver.state.page;
    this.#perPage = page.kind === 'offset' ? page.perPage : undefined;
  }

  /** Narrows the search to the month (run by `ownsMonth`, after rendering). */
  attach = () => {
    const { driver } = this.args.search;
    driver.transaction(() => {
      driver.setPerPage(100); // the whole month
      this.#narrow();
    });
  };

  /** Gives the search back: no month scope, the old page size. */
  detach = () => {
    const { driver } = this.args.search;
    driver.setScope('calendar', undefined);
    if (this.#perPage) driver.setPerPage(this.#perPage);
  };

  get dateProperty(): Property<never, unknown> | undefined {
    return toProperties(this.args.properties).find(
      (p) => p.views?.calendar?.date,
    );
  }

  get title(): string {
    return `${MONTHS.at(this.month - 1)} ${this.year}`;
  }

  get weeks(): Day[][] {
    const first = new Date(Date.UTC(this.year, this.month - 1, 1));
    const start = new Date(first);
    start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7)); // weeks start Monday
    const weeks: Day[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: Day[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + w * 7 + d);
        week.push({
          key: day.toISOString().slice(0, 10),
          number: day.getUTCDate(),
          inMonth: day.getUTCMonth() === this.month - 1,
        });
      }
      if (w > 3 && !week.some((day) => day.inMonth)) break;
      weeks.push(week);
    }
    return weeks;
  }

  rowsOn = (day: Day): unknown[] => {
    const property = this.dateProperty;
    if (!property) return [];
    return this.args.search.results.filter((row) => {
      const value = readPath(row, property.field.path);
      return typeof value === 'string' && value.startsWith(day.key);
    });
  };

  titleOf = (row: unknown) => {
    const titled = toProperties(this.args.properties).find(
      (p) => p.views?.list?.role === 'title',
    );
    return titled ? display(titled, row) : '';
  };

  previous = () => this.#move(-1);
  next = () => this.#move(1);

  #move(delta: number) {
    const index = this.year * 12 + (this.month - 1) + delta;
    this.year = Math.floor(index / 12);
    this.month = (index % 12) + 1;
    this.#narrow();
  }

  #narrow() {
    const property = this.dateProperty;
    if (!property) return;
    const from = `${this.year}-${pad(this.month)}-01`;
    const nextMonth = this.month === 12 ? 1 : this.month + 1;
    const nextYear = this.month === 12 ? this.year + 1 : this.year;
    this.args.search.driver.setScope(
      'calendar',
      range(property.field.path, {
        gte: date(from),
        lt: date(`${nextYear}-${pad(nextMonth)}-01`),
      }),
    );
  }

  <template>
    <div
      class="property-calendar"
      data-test-property-calendar
      {{ownsMonth this}}
    >
      <div class="calendar-head">
        <button
          type="button"
          data-test-previous
          {{on "click" this.previous}}
        >‹</button>
        <h3 data-test-month>{{this.title}}</h3>
        <button type="button" data-test-next {{on "click" this.next}}>›</button>
      </div>
      <div class="calendar-grid">
        {{#each this.weeks as |week|}}
          {{#each week key="key" as |day|}}
            <div
              class="calendar-day {{unless day.inMonth 'is-outside'}}"
              data-day={{day.key}}
            >
              <span class="calendar-number">{{day.number}}</span>
              {{#each (this.rowsOn day) as |row|}}
                <span
                  class="calendar-item"
                  data-test-calendar-item
                >{{this.titleOf row}}</span>
              {{/each}}
            </div>
          {{/each}}
        {{/each}}
      </div>
    </div>
  </template>
}
