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

module.exports.execute2 = async function (N, pols, F) {
    for (let i=0; i<N; i++) {
        const v = BigInt(i);
        pols.a[i] = v;
        pols.c[(i + 3)%N] = v + 1n;
        pols.b[(i + N - 2)%N] = F.mul(v, v + 1n);
    }
}

module.exports.execute3 = async function (N, pols, F) {
    for (let i=0; i<N; i++) {
        const v = BigInt(i);
        pols.a[0][0][i] = v;
        pols.a[0][1][i] = v + 1n;
        pols.a[0][2][i] = v + 2n;
        pols.b[0][i] = F.mul(v, F.mul(v + 1n, v + 2n));

        pols.a[1][0][i] = v;
        pols.a[1][1][i] = v - 1n;
        pols.a[1][2][i] = v - 2n;
        pols.b[1][i] = F.mul(v, F.mul(v - 1n, v - 2n));
    }
}