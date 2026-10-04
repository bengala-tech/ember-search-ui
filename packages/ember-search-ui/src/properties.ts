import type { ComponentLike } from '@glint/template';
import type {
  ConditionNode,
  ConditionPatch,
  FilterSpec,
  Property,
  PropertyInput,
} from 'ember-search-ui-driver';

// Ember types for the Property component slots. The driver types `editor`
// and `chip` as unknown (it is framework-agnostic); here they are Glint
// components with these signatures.

/** A filter editor: edits one condition (operator + value) of a property. */
export interface FilterEditorSignature {
  Args: {
    property: Property;
    /** The current condition; undefined when nothing is set yet. */
    node: ConditionNode | undefined;
    /** Sets or changes the condition (creating it when needed). */
    update: (patch: ConditionPatch) => void;
    /** Removes the condition. */
    remove: () => void;
  };
}

/** Shows a set condition in a filter summary. */
export interface FilterChipSignature {
  Element?: HTMLElement;
  Args: {
    property: Property;
    node: ConditionNode;
    remove: () => void;
  };
}

/** A filter spec whose editor and chip are Ember components. */
export type EmberFilterSpec<Rec = unknown> = FilterSpec<
  Rec,
  ComponentLike<FilterEditorSignature>,
  ComponentLike<FilterChipSignature>
>;

/** A PropertyInput whose filter editor and chip are Ember components. */
export type EmberPropertyInput<Rec = unknown, Value = unknown> = Omit<
  PropertyInput<Rec, Value>,
  'filter'
> & { filter?: false | EmberFilterSpec<Rec> };
