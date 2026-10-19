import {
  nodeLabel,
  type FieldDefinition,
  type FieldSchema,
  type FilterNode,
  type GroupNode,
  type RangeValue,
  type Scalar,
} from 'ember-search-ui-driver';
import { conditionOf, conditionsFor, formatInput } from './conditions.ts';

/**
 * A one-line, human-readable form of a filter tree, e.g.
 *   (x is b AND u is k) OR NOT (t is k)
 * A node with a label (or a `meta.label`) reads as its label. Disabled
 * nodes are left out; an empty tree reads "everything".
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
  const label = nodeLabel(node);
  if (label !== undefined)
    return withNot(node, { text: label, compound: false });
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
  return withNot(node, described);
}

const withNot = (node: FilterNode, described: Described): Described =>
  node.negate
    ? { text: `NOT ${embed(described)}`, compound: false }
    : described;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * A filter pill's text: the node's label, else a short description:
 * "Project: Plant A", "Cost: is at least 3000", "2 conditions", "any of 2
 * conditions". A negated node reads "NOT …". Disabled nodes are described
 * too (a pill shows them switched off).
 */
export function describePill(
  node: FilterNode,
  fields: FieldSchema = {},
): string {
  const text = nodeLabel(node) ?? pillDescription(node, fields);
  return node.negate ? `NOT ${text}` : text;
}

function pillDescription(node: FilterNode, fields: FieldSchema): string {
  switch (node.kind) {
    case 'condition': {
      const field = fields[node.field];
      const label = field?.label ?? node.field;
      if (node.operator === 'eq' || node.operator === 'in') {
        const values = (
          Array.isArray(node.value) ? node.value : [node.value]
        ) as unknown[];
        return `${label}: ${values.map((v) => showValue(v, field)).join(', ')}`;
      }
      return `${label}: ${describeValue(node.operator, node.value, field)}`;
    }
    case 'group': {
      const count = plural(node.children.length, 'condition');
      if (node.children.length === 0) return 'no conditions';
      return node.op === 'or' && node.children.length > 1
        ? `any of ${count}`
        : count;
    }
    case 'nested': {
      const field = fields[node.path];
      const inner = describeNode(node.filter, field?.fields ?? {});
      const label = field?.label ?? node.path;
      const quantifier = { some: 'some', every: 'every', none: 'no' }[
        node.quantifier
      ];
      return inner
        ? `${quantifier} ${label} item where (${inner.text})`
        : `${label}: no conditions`;
    }
  }
}

const showValue = (v: unknown, field: FieldDefinition | undefined) => {
  const option = field?.options?.find((o) => o.value === v);
  return option ? option.label : formatInput(v);
};

function describeCondition(
  path: string,
  operator: string,
  value: unknown,
  field: FieldDefinition | undefined,
): string {
  const label = field?.label ?? path;
  return `${label} ${describeValue(operator, value, field)}`;
}

/** The condition without its field: "is any of [a, b]", "is at least 3". */
function describeValue(
  operator: string,
  value: unknown,
  field: FieldDefinition | undefined,
): string {
  const base = conditionOf({ operator, value: value as never });
  // field-specific wording, e.g. "is after" for dates
  const kind = conditionsFor(field).find((c) => c.id === base.id) ?? base;
  const show = (v: unknown) => showValue(v, field);
  switch (kind.shape) {
    case 'none':
      return kind.label;
    case 'list':
      return `${kind.label} [${((value as Scalar[] | undefined) ?? []).map(show).join(', ')}]`;
    case 'bound':
      return `${kind.label} ${show((value as RangeValue | undefined)?.[kind.bound!])}`;
    case 'between': {
      const { gte, lte } = (value ?? {}) as RangeValue;
      return `${kind.label} ${show(gte)} and ${show(lte)}`;
    }
    default:
      return `${kind.label} ${show(value)}`;
  }
}
