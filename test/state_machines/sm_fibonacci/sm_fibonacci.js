module.exports.buildConstants = async function (N, pols) {

    if(pols) {
        for ( let i=0; i<N; i++) {
            if(pols.L1) pols.L1[i] = (i == 0) ? 1n : 0n;
            if(pols.LLAST) pols.LLAST[i] = (i == N-1) ? 1n : 0n;
        }
    }
}


module.exports.execute = async function (N, pols, input, F) {

    pols.l2[0] = BigInt(input[0]);
    pols.l1[0] = BigInt(input[1]);

    for (let i=1; i<N; i++) {
        pols.l2[i] =pols.l1[i-1];
        pols.l1[i] =F.add(F.square(pols.l2[i-1]), F.square(pols.l1[i-1]));
    }

    return pols.l1[N-1];
}

