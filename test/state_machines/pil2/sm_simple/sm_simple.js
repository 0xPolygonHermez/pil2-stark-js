module.exports.execute = async function (N, pols, F) {
    for (let i=0; i<N; i++) {
        const v = BigInt(i);
        pols.a[i] = v;
        pols.b[i] = F.square(v);
    }
}