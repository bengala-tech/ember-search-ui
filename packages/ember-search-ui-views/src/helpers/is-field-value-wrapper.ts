export function isFieldValueWrapper(object: unknown): boolean {
  return (
    !!object &&
    typeof object === 'object' &&
    (Object.prototype.hasOwnProperty.call(object, 'raw') ||
      Object.prototype.hasOwnProperty.call(object, 'snippet'))
  );
}

export default isFieldValueWrapper;
