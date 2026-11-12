export function cosineSimilarity(left, right) {
    if (!left.length || left.length !== right.length)
        return 0;
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index];
        leftMagnitude += left[index] * left[index];
        rightMagnitude += right[index] * right[index];
    }
    if (!leftMagnitude || !rightMagnitude)
        return 0;
    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
export function reciprocalRankFusion(lexical, semantic, limit) {
    const scores = new Map();
    const addRanks = (items) => {
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
