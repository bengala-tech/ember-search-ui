import type {
  FieldDefinition,
  FieldSchema,
  FilterNode,
  GroupNode,
  RangeValue,
  Scalar,
} from 'ember-search-ui-driver';
import { conditionOf, conditionsFor, formatInput } from './conditions.ts';

/**
 * A one-line, human-readable form of a filter tree, e.g.
 *   (x is b AND u is k) OR NOT (t is k)
 * Disabled nodes are left out; an empty tree reads "everything".
 */
export function describeFilter(
  root: GroupNode,
  fields: FieldSchema = {},
): string {
  return describeNode(root, fields)?.text ?? 'everything';
}

/** `compound`: several parts joined by AND/OR, needing parentheses when embedded. */
interface Described {
  text: string;
  compound: boolean;
}

const embed = ({ text, compound }: Described) =>
  compound ? `(${text})` : text;

function describeNode(
  node: FilterNode,
  fields: FieldSchema,
): Described | undefined {
  if (node.disabled) return undefined;
  let described: Described;
  switch (node.kind) {
    case 'condition':
      described = {
        text: describeCondition(
          node.field,
          node.operator,
          node.value,
          fields[node.field],
        ),
        compound: false,
      };
      break;
    case 'group': {
      const parts = node.children
        .map((child) => describeNode(child, fields))
        .filter((p): p is Described => p !== undefined);
      if (parts.length === 0) return undefined;
      if (parts.length === 1) {
        described = parts[0]!;
      } else {
        described = {
          text: parts.map(embed).join(node.op === 'and' ? ' AND ' : ' OR '),
          compound: true,
        };
      }
      break;
    }
    case 'nested': {
      const field = fields[node.path];
      const inner = describeNode(node.filter, field?.fields ?? {});
      if (inner === undefined) return undefined;
      const label = field?.label ?? node.path;
      const quantifier = { some: 'some', every: 'every', none: 'no' }[
        node.quantifier
      ];
      described = {
        text: `${quantifier} ${label} item where (${inner.text})`,
        compound: false,
      };
      break;
    }
  }
  return node.negate
    ? { text: `NOT ${embed(described)}`, compound: false }
    : described;
}

function describeCondition(
  path: string,
  operator: string,
  value: unknown,
  field: FieldDefinition | undefined,
): string {
  const label = field?.label ?? path;
  const base = conditionOf({ operator, value: value as never });
  // field-specific wording, e.g. "is after" for dates
  const kind = conditionsFor(field).find((c) => c.id === base.id) ?? base;
  const show = (v: unknown) => {
    const option = field?.options?.find((o) => o.value === v);
    return option ? option.label : formatInput(v);
  };
  switch (kind.shape) {
    case 'none':
      return `${label} ${kind.label}`;
    case 'list':
      return `${label} ${kind.label} [${((value as Scalar[] | undefined) ?? []).map(show).join(', ')}]`;
    case 'bound':
      return `${label} ${kind.label} ${show((value as RangeValue | undefined)?.[kind.bound!])}`;
    case 'between': {
      const { gte, lte } = (value ?? {}) as RangeValue;
      return `${label} ${kind.label} ${show(gte)} and ${show(lte)}`;
    }
    default:
      return `${label} ${kind.label} ${show(value)}`;
  }
}
