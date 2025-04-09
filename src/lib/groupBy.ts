export const groupBy = <T, K extends string | number>(
  array: T[],
  getKey: (item: T) => K,
): Record<K, T[]> =>
  array.reduce(
    (groups, item) => {
      const key = getKey(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<K, T[]>,
  );
