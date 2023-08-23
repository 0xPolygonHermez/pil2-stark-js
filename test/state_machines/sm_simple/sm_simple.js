module.exports.buildConstants = async function (N, pols) {
    if(pols) {
        for ( let i=0; i<N; i++) {
            if(pols.LAST) {
                if(pols.LAST.length == 2) {
                    pols.LAST[0][i] = (i == N-1) ? 1n : 0n;
                    pols.LAST[1][i] = (i == N-2) ? 1n : 0n;
                } else {
                    pols.LAST[i] = (i == N-1) ? 1n : 0n;
                }
            } 

            if(pols.L1) {
                pols.L1[i] = i == 0 ? 1n : 0n;
            }
        }
    }
}


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
        if(pols.c) {
            pols.c[i] = BigInt(N - i - 1);
        }
    }
}
