/**
 * @template T
 *
 * @param {Iterable<T>} interable
 *
 * @returns {Set<T>}
 */
function from(interable) {
    return new Set(interable);
}

/**
 * @template T1
 * @template T2
 *
 * @param {Set<T1>} s1
 * @param {Set<T2>} s2
 *
 * @returns {Set<T1>}
 */
function union(s1, s2) {
    const res = new Set(s1);
    for (let elem of s2) {
        res.add(elem);
    }

    return res;
}

/**
 * @template T1
 * @template T2
 *
 * @param {Set<T1>} s1
 * @param {Set<T2>} s2
 *
 * @returns {Set<T1 & T2>}
 */
function difference(s1, s2) {
    const res = new Set(s1);
    for (let elem of s2) {
        res.delete(elem);
    }

    return res;
}

module.exports = {
    from,
    union,
    difference,
};
