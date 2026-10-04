export function wrapOptions<T>(opts: T[] | undefined) {
  return opts?.map((opt) => ({ label: opt, value: opt }));
}

export default wrapOptions;
