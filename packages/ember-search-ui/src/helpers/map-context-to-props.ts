import type { SearchContextState } from '@elastic/search-ui';

export type MappedContext<K extends keyof SearchContextState> = Pick<
  SearchContextState,
  K
>;

export const mapContextToProps = <K extends keyof SearchContextState>(
  desiredProps: K[] = [],
) => {
  return (context: SearchContextState): MappedContext<K> => {
    const mappedProps = {} as MappedContext<K>;
    desiredProps.forEach((prop) => {
      if (Object.prototype.hasOwnProperty.call(context, prop)) {
        mappedProps[prop] = context[prop];
      }
    });
    return mappedProps;
  };
};

export default function mapContextToPropsHelper<
  K extends keyof SearchContextState,
>(...desiredProps: K[]) {
  return mapContextToProps(desiredProps);
}
