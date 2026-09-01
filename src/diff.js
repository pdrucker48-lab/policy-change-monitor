function tokenize(value) {
    return new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function textSimilarity(left, right) {
    const a = tokenize(left);
    const b = tokenize(right);
    if (a.size === 0 && b.size === 0) return 1;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection += 1;
    return intersection / new Set([...a, ...b]).size;
}

function createLcsMatrix(before, after) {
    const matrix = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
    for (let i = 1; i <= before.length; i += 1) {
        for (let j = 1; j <= after.length; j += 1) {
            matrix[i][j] = before[i - 1] === after[j - 1]
                ? matrix[i - 1][j - 1] + 1
                : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
    }
    return matrix;
}

function toOperations(before, after) {
    const matrix = createLcsMatrix(before, after);
    const operations = [];
    let i = before.length;
    let j = after.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
            operations.push({ type: 'equal', value: before[i - 1] });
            i -= 1;
            j -= 1;
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            operations.push({ type: 'added', value: after[j - 1] });
            j -= 1;
        } else {
            operations.push({ type: 'removed', value: before[i - 1] });
            i -= 1;
        }
    }
    return operations.reverse();
}

function pairHunk(removed, added) {
    const changes = [];
    const usedAdded = new Set();

    for (const before of removed) {
        let bestIndex = -1;
        let bestScore = 0;
        for (let index = 0; index < added.length; index += 1) {
            if (usedAdded.has(index)) continue;
            const score = textSimilarity(before, added[index]);
            if (score > bestScore) {
                bestIndex = index;
                bestScore = score;
            }
        }

        if (bestIndex >= 0 && bestScore >= 0.28) {
            usedAdded.add(bestIndex);
            changes.push({ type: 'modified', before, after: added[bestIndex], similarity: Number(bestScore.toFixed(3)) });
        } else {
            changes.push({ type: 'removed', before, after: null, similarity: 0 });
        }
    }

    for (let index = 0; index < added.length; index += 1) {
        if (!usedAdded.has(index)) changes.push({ type: 'added', before: null, after: added[index], similarity: 0 });
    }
    return changes;
}

export function diffBlocks(before, after, { maxChanges = 100 } = {}) {
    if (before.length > 2_000 || after.length > 2_000) throw new Error('Page contains too many text blocks to compare safely');
    const operations = toOperations(before, after);
    const changes = [];
    let removed = [];
    let added = [];

    const flush = () => {
        if (removed.length || added.length) changes.push(...pairHunk(removed, added));
        removed = [];
        added = [];
    };

    for (const operation of operations) {
        if (operation.type === 'equal') {
            flush();
        } else if (operation.type === 'removed') {
            removed.push(operation.value);
        } else {
            added.push(operation.value);
        }
    }
    flush();

    return {
        changes: changes.slice(0, maxChanges),
        totalChanges: changes.length,
        truncated: changes.length > maxChanges,
    };
}
