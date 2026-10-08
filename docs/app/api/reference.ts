// The API reference. A test checks it against each package's runtime
// exports, both ways: an export missing here, or an entry for something no
// longer exported, fails the build.

export type ApiKind = 'class' | 'function' | 'component' | 'constant' | 'type';

export interface ApiEntry {
  name: string;
  kind: ApiKind;
  summary: string;
  /** A guide slug that explains it. */
  guide?: string;
}

export interface ApiSection {
  title: string;
  entries: ApiEntry[];
}

export interface ApiPackage {
  name: 'ember-search-ui-driver' | 'ember-search-ui' | 'ember-search-ui-views';
  summary: string;
  sections: ApiSection[];
}

const fn = (name: string, summary: string, guide?: string): ApiEntry => ({
  name,
  kind: 'function',
  summary,
  ...(guide ? { guide } : {}),
});
const cls = (name: string, summary: string, guide?: string): ApiEntry => ({
  name,
  kind: 'class',
  summary,
  ...(guide ? { guide } : {}),
});
const cmp = (name: string, summary: string, guide?: string): ApiEntry => ({
  name,
  kind: 'component',
  summary,
  ...(guide ? { guide } : {}),
});
const val = (name: string, summary: string): ApiEntry => ({
  name,
  kind: 'constant',
  summary,
});
const type = (name: string, summary: string, guide?: string): ApiEntry => ({
  name,
  kind: 'type',
  summary,
  ...(guide ? { guide } : {}),
});

export const API: ApiPackage[] = [
  {
    name: 'ember-search-ui-driver',
    summary:
      'The search driver, Properties, codecs and backends. Framework-agnostic.',
    sections: [
      {
        title: 'Driver',
        entries: [
          cls(
            'SearchDriver',
            'Owns the search state; commands change it, one search runs per settled change.',
            'driver',
          ),
          fn(
            'createState',
            'A search state with defaults, optionally overridden.',
          ),
          fn('firstPage', 'The same pagination, back on its first page.'),
          val('DEFAULT_PER_PAGE', 'The page size when none is given.'),
          fn(
            'sequentialIds',
            'An id factory giving predictable ids (tests, SSR).',
          ),
          fn('randomIds', 'The default id factory.'),
          type(
            'SearchState',
            'query, filter, sort, page and extensions.',
            'driver',
          ),
          type(
            'Snapshot',
            'An immutable { state, result } pair, as listeners get it.',
            'driver',
          ),
          type(
            'DriverOptions',
            'backend, initialState, schema, operators, debounceMs, searchOnInit.',
          ),
        ],
      },
      {
        title: 'Building filters',
        entries: [
          fn('and', 'A group whose children must all match.', 'driver'),
          fn('or', 'A group where any child may match.', 'driver'),
          fn('not', 'The same node, negated.', 'driver'),
          fn('disabled', 'The same node, switched off.'),
          fn('withId', 'The same node with a given id.'),
          fn('where', 'A condition with any operator.'),
          fn('eq', 'Field equals a value.', 'driver'),
          fn('anyOf', 'Field equals one of the values.', 'driver'),
          fn('allOf', 'A multi-valued field holds every value.'),
          fn('range', 'Field within gt / gte / lt / lte bounds.', 'driver'),
          fn('exists', 'Field has (or lacks) a value.'),
          fn('contains', 'Text field contains a phrase.'),
          fn('prefix', 'Field starts with a string.'),
          fn('raw', 'A value sent to the backend as it is.'),
          fn(
            'nested',
            'Items of a list must match a filter (some, every, none).',
            'driver',
          ),
          fn('date', 'An exact date value.'),
          fn('dateMath', 'A relative date: now-7d, now/M.'),
          fn(
            'filterToCode',
            'A filter tree printed as the builder calls that make it.',
            'filtering',
          ),
        ],
      },
      {
        title: 'The filter tree',
        entries: [
          val('ROOT_ID', 'The id of the root group: root.'),
          cls(
            'TreeError',
            'Thrown by tree edits on unknown ids or invalid moves.',
          ),
          fn('emptyRoot', 'An empty root group.'),
          fn('materialize', 'A node from builder input, with ids.'),
          fn('walk', 'Visits every node.'),
          fn('collectIds', 'Every id in a tree.'),
          fn('findNode', 'A node by id.'),
          fn('findParent', 'The group holding a node.'),
          fn('mapNode', 'A tree with one node replaced.'),
          fn('insertNode', 'A tree with a node inserted.'),
          fn('removeNode', 'A tree without a node.'),
          fn('updateNode', 'A tree with a node patched.'),
          fn('moveNode', 'A tree with a node moved.'),
          fn('prune', 'The tree without nodes that have no effect.'),
          fn('flatten', 'Merges nested groups of the same kind.'),
          fn('pushNegation', 'Moves negation down to the conditions.'),
          fn('hasOnlyLeafNegation', 'Is negation only on conditions?'),
          fn(
            'invalidConditions',
            'Conditions whose values are incomplete or invalid.',
          ),
          type(
            'FilterNode',
            'A group, a condition or a nested node.',
            'driver',
          ),
          type(
            'ConditionPatch',
            'The fields of a condition update can change.',
          ),
        ],
      },
      {
        title: 'Semantics',
        entries: [
          cls(
            'OperatorRegistry',
            'The operators a driver knows; register your own.',
          ),
          val(
            'BUILT_IN_OPERATORS',
            'eq, in, all, range, exists, contains, prefix, raw.',
          ),
          fn(
            'matches',
            'Does a record match a filter tree? With get and match hooks.',
          ),
          fn('isActive', 'Does a node have any effect?'),
          fn('isValidCondition', 'Is a condition complete and valid?'),
          fn('fieldValues', 'The values at a path, arrays flattened.'),
          fn('flattenValues', 'A read value as evaluator values.'),
          fn('nestedItems', 'The objects in the list at a path.'),
          fn('resolveDate', 'A date or date-math value in milliseconds.'),
          fn('isDateValue', 'Is a value a date value?'),
          fn('isRangeValue', 'Is a value a range?'),
          fn('dateLikeToISO', 'A Date or moment as an ISO string.'),
        ],
      },
      {
        title: 'Properties',
        entries: [
          fn(
            'defineProperty',
            'Copies and freezes a property; fills key and field.label defaults.',
            'properties',
          ),
          fn(
            'extendProperty',
            'A property with overrides merged in deeply.',
            'properties',
          ),
          fn('propertyValue', 'The display value of a record.', 'properties'),
          fn('readPath', 'Plain property access along a dotted path.'),
          fn(
            'sortPath',
            'The path a property sorts on, or undefined.',
            'properties',
          ),
          fn('exportValue', 'The exported value of a record.', 'properties'),
          fn('isSortable', 'Can the property be sorted?'),
          fn('isFilterable', 'Can the property be filtered?'),
          fn('isExportable', 'Is the property exported?'),
          fn(
            'operatorsFor',
            'The operators a filter UI offers for a property.',
            'properties',
          ),
          fn(
            'defaultOperator',
            'The explicit default operator, or the first offered.',
            'properties',
          ),
          fn('optionsFor', "The property's options source.", 'properties'),
          fn(
            'staticOptions',
            'Fixed picker options with load, label search and value resolution.',
            'properties',
          ),
          fn('findProperty', 'A property by key or field path.'),
          fn(
            'schemaFrom',
            'Field schema from filterable properties, keyed by field.path.',
            'properties',
          ),
          fn(
            'propertyMatcher',
            "An evaluator match running each property's filter.local.",
            'backends',
          ),
          type(
            'Property',
            'A field described once: field, value, sort, filter, views, link, export, meta.',
            'properties',
          ),
          type(
            'PropertyViews',
            'Per-view config; each view adds its key.',
            'properties',
          ),
          type(
            'FilterSpec',
            'operators, defaultOperator, editor, chip, options, local.',
            'properties',
          ),
          type(
            'OptionsSource',
            'load, search and resolve picker options.',
            'properties',
          ),
        ],
      },
      {
        title: 'Filter bars',
        entries: [
          fn(
            'propertyFilter',
            "A property's filter: the root condition on its field, if set.",
            'filtering',
          ),
          fn(
            'setPropertyFilter',
            "Sets, changes or removes a property's filter.",
            'filtering',
          ),
        ],
      },
      {
        title: 'Legacy properties',
        entries: [
          fn(
            'toProperty',
            'A Property for either shape (cached, read live).',
            'legacy-properties',
          ),
          fn('toProperties', 'toProperty over a list.', 'legacy-properties'),
          fn('isLegacyProperty', 'Is this a legacy property?'),
          fn('legacyOf', 'The legacy object behind a property.'),
          fn(
            'legacyFilterPath',
            'The filter path, as legacy getters compute it.',
          ),
          fn('legacyUseFilter', 'Filterable, as legacy getters compute it.'),
          fn(
            'legacyOptions',
            'A legacy collection as an options source.',
            'legacy-properties',
          ),
          fn(
            'legacyValueHooks',
            'serialize / deserialize as codec value hooks.',
            'legacy-properties',
          ),
          fn('legacyEditorValue', 'The @value a legacy filter editor gets.'),
          fn('legacyChipValues', 'The @value a legacy chip gets.'),
          fn(
            'legacyValuePatch',
            "A legacy editor's value as a condition patch.",
          ),
          fn(
            'configureLegacyProperties',
            'Opt-in hints about legacy fields in use.',
            'legacy-properties',
          ),
          type(
            'LegacyProperty',
            'The legacy property shape, supported as is.',
            'legacy-properties',
          ),
        ],
      },
      {
        title: 'Backends and codecs',
        entries: [
          fn(
            'memoryBackend',
            'Searches an array with the driver semantics.',
            'backends',
          ),
          fn(
            'searchApiBackend',
            'A backend for JSON search APIs (list or groups format).',
            'backends',
          ),
          fn(
            'searchApiCodec',
            'The request codec of searchApiBackend.',
            'backends',
          ),
          fn('searchApiListFilters', 'The legacy list filter format.'),
          fn('searchApiGroupFilters', 'The groups filter format.'),
          cls(
            'UnsupportedNodeError',
            'A codec cannot express a node.',
            'backends',
          ),
          fn(
            'withPaths',
            'Wraps a codec so it sees backend field names.',
            'backends',
          ),
          fn('mapStatePaths', 'Renames every path in a state.'),
          fn('mapSchemaPaths', 'Renames the keys of a schema.'),
          fn('invertPaths', 'The inverse of a path table.'),
          type('Backend', 'codec, search and normalize.', 'backends'),
        ],
      },
      {
        title: 'URL',
        entries: [
          fn('urlCodec', 'The search state as URL parameters.', 'driver'),
          fn(
            'syncUrl',
            'Keeps the URL and the driver in sync; returns stop.',
            'driver',
          ),
          fn('browserHistory', 'The URL adapter over window.history.'),
          fn('memoryHistory', 'A URL adapter in memory (tests, SSR).'),
        ],
      },
      {
        title: 'search-ui compatibility',
        entries: [
          cls(
            'SearchUiCompat',
            "search-ui's driver API over a SearchDriver.",
            'migrating-from-search-ui',
          ),
          fn(
            'searchUiCompat',
            'Wraps a driver in the search-ui API.',
            'migrating-from-search-ui',
          ),
          cls(
            'ServerSearchCompat',
            'searchUiCompat plus the server driver API.',
            'migrating-from-search-ui',
          ),
          fn(
            'serverSearch',
            'A server-backed driver with the search-ui API.',
            'migrating-from-search-ui',
          ),
          cls(
            'LocalSearchCompat',
            'searchUiCompat plus setData / setProperties / runSearch.',
            'migrating-from-search-ui',
          ),
          fn(
            'localSearch',
            'An in-memory driver with the legacy local semantics.',
            'migrating-from-search-ui',
          ),
          fn('emberLikeCompare', "Ember's compare, without Ember."),
          fn(
            'fromSearchUiState',
            'A search-ui state (a query param) as a SearchState.',
          ),
          fn('filterToNode', 'A search-ui filter as a condition node.'),
          fn('nodeToFilter', 'A condition node as a search-ui filter.'),
          val(
            'ARRAY_VALUE_META',
            'Node meta flag: the values were one array value.',
          ),
          fn('isArrayValue', 'Does a node carry that flag?'),
        ],
      },
    ],
  },
  {
    name: 'ember-search-ui',
    summary:
      'Ember integration: the tracked search, property filters, and the search-ui compatible components.',
    sections: [
      {
        title: 'Driver integration',
        entries: [
          cmp(
            'Search',
            'Yields a TrackedSearch for a driver (or one it creates).',
            'getting-started',
          ),
          cls(
            'TrackedSearch',
            'The driver snapshot as tracked state, with test waiters.',
            'driver',
          ),
          fn('trackSearch', 'A TrackedSearch tied to an owner.', 'driver'),
        ],
      },
      {
        title: 'Properties',
        entries: [
          cmp(
            'PropertyFilter',
            "A property's editor on its filter-bar condition.",
            'filtering',
          ),
          cmp(
            'PropertyChip',
            "A property's set filter as a chip.",
            'filtering',
          ),
          cmp(
            'LegacyFilterEditor',
            'Runs a legacy filter component unchanged.',
            'legacy-properties',
          ),
          cmp(
            'LegacyFilterChip',
            'Runs legacy listValues / listValue components.',
            'legacy-properties',
          ),
          type(
            'FilterEditorSignature',
            'property, node, update, remove.',
            'filtering',
          ),
          type('FilterChipSignature', 'property, node, remove.'),
        ],
      },
      {
        title: 'search-ui components',
        entries: [
          cmp('SearchProvider', 'Provides a search-ui driver to its block.'),
          fn('setupDriver', 'Creates a search-ui driver from a config.'),
          cmp(
            'WithSearch',
            'Yields search-ui state picked by mapContextToProps.',
            'migrating-from-search-ui',
          ),
          fn(
            'mapContextToProps',
            'Picks search-ui state and actions for WithSearch.',
            'migrating-from-search-ui',
          ),
          cmp('ErrorBoundaryContainer', 'Search errors.'),
          cmp('FacetContainer', 'One facet: values, selection, more/less.'),
          cmp('PagingContainer', 'Current page, page count, onChange.'),
          cmp('PagingInfoContainer', 'Start, end and total of the page.'),
          cmp('ResultContainer', 'One result, with click tracking.'),
          cmp('ResultsContainer', 'The results.'),
          cmp('ResultsPerPageContainer', 'Page size options.'),
          cmp('SearchBoxContainer', 'Search term, autocomplete, submit.'),
          cmp('SortingContainer', 'Sort options and the current sort.'),
          fn(
            'resolveComponent',
            'A view given as a component or a registered name.',
          ),
        ],
      },
    ],
  },
  {
    name: 'ember-search-ui-views',
    summary:
      'Ready views: filter bars, the query builder, and classic search views.',
    sections: [
      {
        title: 'Filtering',
        entries: [
          cmp('FilterBar', 'One filter per property, ANDed.', 'filtering'),
          cmp('FilterChips', 'The set filters as chips.', 'filtering'),
          cmp(
            'QueryBuilder',
            'The whole filter tree: groups, OR, NOT, on/off, nested lists.',
            'filtering',
          ),
          cmp(
            'ConditionEditor',
            'The built-in operator picker and value input.',
            'filtering',
          ),
          fn('describeFilter', 'A filter tree in words.'),
          val('CONDITIONS', "The query builder's condition kinds."),
          val('DATE_PRESETS', 'Relative date choices (last 7 days...).'),
          fn('conditionsFor', 'The condition kinds a field offers.'),
          fn('conditionOf', "A condition node's kind."),
          fn(
            'switchCondition',
            'A condition changed to another kind, keeping what fits.',
          ),
        ],
      },
      {
        title: 'Classic views',
        entries: [
          cmp('SearchBox', 'A search input with autocomplete.'),
          cmp('AutocompleteInput', 'The input behind SearchBox.'),
          cmp('Results', 'A list of results.'),
          cmp('Result', 'One result.'),
          cmp('Facets', 'A list of facets.'),
          cmp('Facet', 'A facet with a chosen view.'),
          cmp('MultiCheckboxFacet', 'A facet as checkboxes.'),
          cmp('SingleSelectFacet', 'A facet as a select.'),
          cmp('SingleLinksFacet', 'A facet as links.'),
          cmp('BooleanFacet', 'A facet as one checkbox.'),
          cmp('Paging', 'Page links.'),
          cmp('PagingInfo', 'Showing x–y of z.'),
          cmp('ResultsPerPage', 'A page size picker.'),
          cmp('Sorting', 'A sort picker.'),
          cmp('ErrorBoundary', 'Shows search errors, still yields.'),
          cmp('Layout', 'A header, sidebar and body layout.'),
          cmp('LayoutSidebar', "The layout's collapsible sidebar."),
          cmp('Trigger', 'A button that toggles content.'),
        ],
      },
    ],
  },
];
