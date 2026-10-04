import { assert } from '@ember/debug';
import { getOwner } from '@ember/owner';
import type { ComponentLike } from '@glint/template';

/**
 * `@view`-style arguments accept a component, or (for apps using loose-mode
 * templates) the name of a component registered in the app.
 */
export type ViewArg<S> = ComponentLike<S> | string;

export function resolveComponent<S>(
  context: object,
  value: ViewArg<S> | undefined,
): ComponentLike<S> | undefined {
  if (typeof value !== 'string') return value;

  const owner = getOwner(context);
  const factory = owner?.factoryFor(`component:${value}`);
  assert(
    `ember-search-ui: could not find a component named "${value}". Pass the component itself instead of its name.`,
    factory,
  );
  return factory.class as unknown as ComponentLike<S>;
}
