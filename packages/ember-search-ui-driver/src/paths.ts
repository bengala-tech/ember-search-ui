import type { CodecContext, FieldSchema, StateCodec } from './codec.ts';
import type { FieldPath, FilterNode, SearchState } from './types.ts';

// Field paths are the app's names for its fields. A backend may name them
// differently (`created_at` for `createdAt`, `project.name.raw` to sort on
// `project.name`). A path map translates them in a codec, so properties and
// views never know which backend runs them.

/** Semantic path -> backend path: a table, or a function. */
export type PathMap =
  Readonly<Record<FieldPath, FieldPath>> | ((path: FieldPath) => FieldPath);

export interface PathMaps {
  /** Applied to sort fields only, before `paths`. E.g. `.raw` subfields. */
  sort?: PathMap;
  /** Applied to filter fields, nested paths, sort fields and search fields. */
  paths: PathMap;
  /**
   * Backend path -> semantic path, for parsing. Default: the inverse of a
   * table `paths`; for a function `paths`, parsing keeps the backend paths.
   */
  parse?: PathMap;
}

const toFunction = (map: PathMap | undefined) =>
  map === undefined
    ? (path: FieldPath) => path
    : typeof map === 'function'
      ? map
      : (path: FieldPath) => map[path] ?? path;

/** The inverse of a table map. Throws when two paths map to one. */
export function invertPaths(
  map: Readonly<Record<FieldPath, FieldPath>>,
): Record<FieldPath, FieldPath> {
  const inverse: Record<FieldPath, FieldPath> = {};
  for (const [from, to] of Object.entries(map)) {
    if (to in inverse && inverse[to] !== from) {
      throw new TypeError(
        `Paths "${inverse[to]}" and "${from}" both map to "${to}"`,
      );
    }
    inverse[to] = from;
  }
  return inverse;
}

/**
 * Renames every path in a state. Conditions inside a nested scope are
 * renamed by their full path and stay relative to the renamed scope, so
 * `items` + `status` maps through `items.status`.
 */
export function mapStatePaths(
  state: SearchState,
  paths: PathMap,
  sortPaths?: PathMap,
): SearchState {
  const map = toFunction(paths);
  const mapSort = toFunction(sortPaths);
  return {
    ...state,
    filter: mapNode(state.filter, map, '', '') as SearchState['filter'],
    sort: state.sort.map((sort) => ({
      ...sort,
      field: map(mapSort(sort.field)),
    })),
    query: state.query.fields
      ? { ...state.query, fields: state.query.fields.map(map) }
      : state.query,
  };
}

function mapNode(
  node: FilterNode,
  map: (path: FieldPath) => FieldPath,
  scope: FieldPath,
  mappedScope: FieldPath,
): FilterNode {
  const full = (path: FieldPath) => (scope ? `${scope}.${path}` : path);
  const relative = (mapped: FieldPath, original: FieldPath) => {
    if (!mappedScope) return mapped;
    if (!mapped.startsWith(`${mappedScope}.`)) {
      throw new TypeError(
        `"${full(original)}" maps to "${mapped}", outside its nested scope "${mappedScope}"`,
      );
    }
    return mapped.slice(mappedScope.length + 1);
  };
  switch (node.kind) {
    case 'condition':
      return { ...node, field: relative(map(full(node.field)), node.field) };
    case 'group':
      return {
        ...node,
        children: node.children.map((child) =>
          mapNode(child, map, scope, mappedScope),
        ),
      };
    case 'nested': {
      const mapped = map(full(node.path));
      return {
        ...node,
        path: relative(mapped, node.path),
        filter: mapNode(
          node.filter,
          map,
          full(node.path),
          mapped,
        ) as typeof node.filter,
      };
    }
  }
}

/** A schema keyed by mapped paths (for codecs that check field types). */
export function mapSchemaPaths(
  schema: FieldSchema | undefined,
  paths: PathMap,
): FieldSchema | undefined {
  if (!schema) return undefined;
  const map = toFunction(paths);
  const out: Record<FieldPath, FieldSchema[string]> = {};
  for (const [path, definition] of Object.entries(schema)) {
    out[map(path)] = { ...definition, path: map(path) };
  }
  return out;
}

const parseMap = (maps: PathMaps): PathMap | undefined =>
  maps.parse ??
  (typeof maps.paths === 'function' ? undefined : invertPaths(maps.paths));

/**
 * Wraps a codec so it sees backend paths: states are renamed before
 * `serialize` and renamed back after `parse`. The schema in the context is
 * renamed too, so field-type checks keep working.
 */
export function withPaths<External>(
  codec: StateCodec<External>,
  maps: PathMaps,
): StateCodec<External> {
  const back = parseMap(maps);
  const context = (ctx: CodecContext): CodecContext => {
    const schema = mapSchemaPaths(ctx.schema, maps.paths);
    return schema ? { ...ctx, schema } : ctx;
  };
  const wrapped: StateCodec<External> = {
    serialize: (state, ctx) =>
      codec.serialize(
        mapStatePaths(state, maps.paths, maps.sort),
        context(ctx),
      ),
  };
  if (codec.parse) {
    const parse = codec.parse.bind(codec);
    wrapped.parse = (external, ctx) => {
      const state = parse(external, context(ctx));
      return back ? mapStatePaths(state, back) : state;
    };
  }
  return wrapped;
}
