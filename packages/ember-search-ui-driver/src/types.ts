export type NodeId = string;

/** A dotted path into a document: `state`, `custom.4-due_date`. */
export type FieldPath = string;

/** Key of an operator in the operator registry: `eq`, `in`, `range`, ... */
export type OperatorId = string;

export type Scalar = string | number | boolean | null;

/** Dates are explicit so codecs never guess whether a string is a date. */
export type DateValue = { date: string } | { dateMath: string };

export interface RangeValue {
  gt?: Scalar | DateValue;
  gte?: Scalar | DateValue;
  lt?: Scalar | DateValue;
  lte?: Scalar | DateValue;
}

export type FilterValue =
  | Scalar
  | DateValue
  | RangeValue
  | readonly FilterValue[]
  | { readonly [key: string]: unknown };

interface NodeBase {
  readonly id: NodeId;
  /** NOT (this node). */
  readonly negate?: boolean;
  /** Kept in the tree, ignored when searching. */
  readonly disabled?: boolean;
  /** UI-only data (label, owner); never sent to a backend. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface GroupNode extends NodeBase {
  readonly kind: 'group';
  readonly op: 'and' | 'or';
  readonly children: readonly FilterNode[];
}

export interface ConditionNode extends NodeBase {
  readonly kind: 'condition';
  readonly field: FieldPath;
  readonly operator: OperatorId;
  readonly value?: FilterValue;
}

/** "Items of the list at `path` match `filter`"; inner fields are relative to `path`. */
export interface NestedNode extends NodeBase {
  readonly kind: 'nested';
  readonly path: FieldPath;
  readonly quantifier: 'some' | 'every' | 'none';
  readonly filter: GroupNode;
}

export type FilterNode = GroupNode | ConditionNode | NestedNode;

/**
 * The same shapes with optional ids, as written by builders or callers.
 * Ids are assigned when the input enters the tree.
 */
export type GroupInput = Omit<GroupNode, 'id' | 'children'> & {
  readonly id?: NodeId;
  readonly children: readonly NodeInput[];
};
export type ConditionInput = Omit<ConditionNode, 'id'> & {
  readonly id?: NodeId;
};
export type NestedInput = Omit<NestedNode, 'id' | 'filter'> & {
  readonly id?: NodeId;
  readonly filter: GroupInput;
};
export type NodeInput = GroupInput | ConditionInput | NestedInput;

export interface SortItem {
  readonly field: FieldPath;
  readonly direction: 'asc' | 'desc';
}

export type PageState =
  | { readonly kind: 'offset'; readonly page: number; readonly perPage: number }
  | {
      readonly kind: 'cursor';
      readonly cursor: string | null;
      readonly size: number;
    };

export interface SearchState {
  readonly query: {
    readonly term: string;
    readonly fields?: readonly FieldPath[];
  };
  /** Always a group; its id is `root`. */
  readonly filter: GroupNode;
  readonly sort: readonly SortItem[];
  readonly page: PageState;
  /** Backend-specific options, namespaced: `api.refresh`. */
  readonly extensions: Readonly<Record<string, unknown>>;
}

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ValidationWarning {
  readonly nodeId: NodeId;
  readonly message: string;
}

export interface SearchResult<Doc = unknown> {
  readonly status: SearchStatus;
  readonly results: readonly Doc[];
  readonly total: number;
  readonly pageCount: number;
  readonly aggregations: Readonly<Record<string, unknown>>;
  readonly error?: unknown;
  /** Nodes skipped because their value was invalid. */
  readonly warnings: readonly ValidationWarning[];
  /** The backend's raw response of the last successful search. */
  readonly response?: unknown;
}

/** What a backend's `normalize` returns; the driver adds the status. */
export type NormalizedResponse<Doc = unknown> = Pick<
  SearchResult<Doc>,
  'results' | 'total'
> &
  Partial<Pick<SearchResult<Doc>, 'pageCount' | 'aggregations'>>;
