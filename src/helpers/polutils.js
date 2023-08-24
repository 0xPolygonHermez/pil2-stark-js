module.exports.polMulAxi = function polMulAxi(F, p, init, acc) {
    let r = init;
    for (let i=0; i<p.length; i++) {
        p[i] = F.mul(p[i], r);
        r = F.mul(r, acc);
    }
}

module.exports.evalPol = function evalPol(F, p, x) {
    if (p.length == 0) return F.zero;
    let res = p[p.length-1];
    for (let i=p.length-2; i>=0; i--) {
        res = F.add(F.mul(res, x), p[i]);
    }
    return res;
}

module.exports.extendPol = function extendPol(F, p, extendBits, shift = true) {
    extendBits = extendBits || 1;
    let res = new Array(p.length);
    for (let i=0; i<p.length; i++) {
        res[i] = F.e(p[i]);
    }
    res = F.ifft(res);
    let acc = shift ? F.shift : F.w[extendBits];
    module.exports.polMulAxi(F, res, F.one, acc);
    for (let i=p.length; i<(p.length<<extendBits); i++) res[i] = F.zero;
    res = F.fft(res);
    return res;
}

module.exports.extendPolBuffer = async function extendPolBuffer(Fr, buffSrc, buffDst) {
    buffDst.set(await Fr.ifft(buffSrc), 0);
    buffDst = await Fr.fft(buffDst);

    return buffDst;
}

module.exports.buildZhInv = function buildZhInv(buffTo, F, nBits, nBitsExt, stark) {
    const extendBits = nBitsExt - nBits;
    const Next = (1<<nBitsExt);
    const extend = (1<<extendBits);
    let w = F.one;
    let sn= F.shift; 
    for (let i=0; i<nBits; i++) sn = F.square(sn);
    for (let i=0; i<extend; i++) {
        const xn = stark ? F.mul(sn, w) : w;
        const zh = F.sub(xn, F.one);
        buffTo[i] = F.inv(zh);
        w = F.mul(w, F.w[extendBits]);
    }
    for (let i=extend; i<Next; i++) {
        buffTo[i] = buffTo[i % extend];
    }
}

module.exports.buildOneRowZerofierInv = function buildOneRowZerofierInv(buffTo, F, nBits, nBitsExt, rowIndex, stark) {
    let root = F.one;
    for(let i = 0; i < rowIndex; ++i) {
        root = F.mul(root, F.w[nBits]);
    }
    let w = F.one;
    let s = F.shift;
    for (let i=0; i< (1 << nBitsExt); i++) {
        const x = stark ? F.mul(s, w) : w;
        const zh = F.sub(x, root);

        buffTo[i] = F.inv(zh);
        w = F.mul(w, F.w[nBitsExt]);
    }
}


module.exports.buildFrameZerofierInv = function buildFrameZerofierInv(buffTo, F, buffZhInv, nBits, nBitsExt, frame, stark) {
   let roots = [];
   for(let i = 0; i < frame.offsetMin; ++i) {
        let root = F.one;
        for (let j = 0; j < i; ++j) {
            root = F.mul(root, F.w[nBits]);
        }
        roots.push(root);
    }
    for(let i = 0; i < frame.offsetMax; ++i) {
        let root = F.one;
        for (let j = 0; j < ((1<<nBits) - i - 1); ++j) {
            root = F.mul(root, F.w[nBits]);
        }
        roots.push(root);
    }

    let w = F.one;
    let s = F.shift;
    for (let i=0; i< (1 << nBitsExt); i++) {
        let zi = buffZhInv[i];
        const x = stark ? F.mul(s, w) : w;
        for(let j = 0; j < roots.length; ++j) {
            zi = F.mul(zi, F.sub(x, roots[j]));
        }
        buffTo[i] = zi;
        w = F.mul(w, F.w[nBitsExt]);
    }
}


module.exports.calculateH1H2 = function calculateH1H2(F, f, t) {
    const idx_t = {};
    const s = [];
    for (i=0; i<t.length; i++) {
        idx_t[t[i]]=i;
        s.push([t[i], i]);
    }
    for (i=0; i<f.length; i++) {
        const idx = idx_t[f[i]];
        if (isNaN(idx)) {
            throw new Error(`Number not included: ${F.toString(f[i])}`);
        }
        s.push([f[i], idx]);
    }

    s.sort( (a, b) => a[1] - b[1] );

    const h1 = new Array(f.length);
    const h2 = new Array(f.length);
    for (let i=0; i<f.length; i++) {
        h1[i] = s[2*i][0];
        h2[i] = s[2*i+1][0];
    }

    return [h1, h2];
}

module.exports.calculateZ = async function(F, num, den) {

    const N = num.length;
    if (N != den.length) throw new Error("Num and Den different sizes");

    const denI = await F.batchInverse(den);

    const z = new Array(N);
    z[0] = F.one;
    for (let i=1; i<N; i++) {
        z[i] = F.mul(z[i-1], F.mul(num[i-1], denI[i-1]));
    }
    const checkVal = F.mul(z[N-1], F.mul(num[N-1], denI[N-1]));
    if (!F.eq(checkVal, F.one)) {
        throw new Error("z does not match");
    }

    return [z];
}
