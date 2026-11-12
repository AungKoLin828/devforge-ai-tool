export type RankedKnowledge<T extends { id: string }> = {
  item: T;
  rank: number;
};

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function reciprocalRankFusion<T extends { id: string }>(
  lexical: RankedKnowledge<T>[],
  semantic: RankedKnowledge<T>[],
  limit: number,
): T[] {
  const scores = new Map<string, { item: T; score: number }>();
  const addRanks = (items: RankedKnowledge<T>[]) => {
    items.forEach(({ item, rank }) => {
      const current = scores.get(item.id) ?? { item, score: 0 };
      current.score += 1 / (60 + rank);
      scores.set(item.id, current);
    });
  };

  addRanks(lexical);
  addRanks(semantic);

  return [...scores.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
