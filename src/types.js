/**
 * JSDoc types lack a non-null assertion.
 * https://github.com/Microsoft/TypeScript/issues/23405#issuecomment-873331031
 *
 * @template T
 * @param {T} value
 * 
 * @returns {NonNullable<T>}
 */
export const notNull = (value) => {
    // Use `==` to check for both null and undefined
    if (value == null) {
      throw new Error(`Did not expect value to be null or undefined`);
    }
    return value;
  };
  