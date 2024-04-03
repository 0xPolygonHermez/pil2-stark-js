module.exports.execute = async function (N, pols, inputs, F) {

    pols.b[0] = BigInt(inputs[0]);
    pols.a[0] = BigInt(inputs[1]);

    for (let i=1; i<N; i++) {
        pols.b[i] =pols.a[i-1];
        pols.a[i] =F.add(F.square(pols.b[i-1]), F.square(pols.a[i-1]));
    }
}

