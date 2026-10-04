import type { IdFactory } from './ids.ts';
import type { OperatorRegistry } from './operators.ts';
import type {
  FieldPath,
  FilterNode,
  GroupNode,
  NormalizedResponse,
  OperatorId,
  Scalar,
  SearchState,
} from './types.ts';

export interface FieldDefinition {
  path: FieldPath;
  type:
    'keyword' | 'text' | 'number' | 'date' | 'boolean' | 'geo' | (string & {});
  /** The path is a list of objects (can be scoped with a nested node). */
  nested?: boolean;
  /** Restricts the operators a UI offers for this field. */
  operators?: OperatorId[];
  label?: string;
  /** Known values, for pickers: states, statuses, users... */
  options?: readonly { value: Scalar; label: string }[];
  /** For `nested` fields: the fields of each item, relative to `path`. */
  fields?: FieldSchema;
}

export type FieldSchema = Readonly<Record<FieldPath, FieldDefinition>>;

export interface CodecContext {
  operators: OperatorRegistry;
  idFactory: IdFactory;
  schema?: FieldSchema;
}

export class UnsupportedNodeError extends Error {
  override name = 'UnsupportedNodeError';
  constructor(
    readonly nodeId: string,
    reason: string,
  ) {
    super(`Node "${nodeId}": ${reason}`);
  }
}

export type Support =
  { ok: true } | { ok: false; nodeId: string; reason: string };

/** Converts a filter tree to and from one external filter format. */
export interface FilterCodec<External> {
  /** Throws UnsupportedNodeError for trees the format cannot express. */
  serialize(filter: GroupNode, ctx: CodecContext): External;
  parse?(external: External, ctx: CodecContext): GroupNode;
  /** Can this subtree be expressed? For UIs to refuse it up front. */
  supports(node: FilterNode, ctx: CodecContext): Support;
}

/** Converts the whole search state to and from one external format. */
export interface StateCodec<External> {
  serialize(state: SearchState, ctx: CodecContext): External;
  parse?(external: External, ctx: CodecContext): SearchState;
}

/** Where searches run: a codec to build the request, a transport, a normalizer. */
export interface Backend<Request = unknown, Response = unknown, Doc = unknown> {
  codec: StateCodec<Request>;
  search: (request: Request, signal: AbortSignal) => Promise<Response>;
  normalize: (
    response: Response,
    state: SearchState,
  ) => NormalizedResponse<Doc>;
}
