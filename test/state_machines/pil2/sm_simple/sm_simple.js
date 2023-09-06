module.exports.execute = async function (N, pols, F) {
    for (let i=0; i<N; i++) {
        const v = BigInt(i);
        if(pols.a.length == 2) {
            pols.a[0][i] = v;
            pols.a[1][i] = v;
        } else {
            pols.a[i] = v;
        }
        pols.b[i] = F.square(v);
    }
}