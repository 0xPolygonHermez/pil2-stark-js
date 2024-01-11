
const ExpressionOps = require("../../expressionops");

const { getExpDim } = require("../helpers");

module.exports.addIntermediatePolynomials = function addIntermediatePolynomials(res, expressions, constraints, symbols, imExps, qDeg, stark, imPolsLastStage = true) {
    const E = new ExpressionOps();

    console.log("Number of intermediate expressions: " + imExps.length);
    console.log("Q degree: " + qDeg);
    
    res.qDeg = qDeg;
    res.nConstraints = constraints.length + imExps.length;

    const dim = stark ? 3 : 1;
    const stage = res.numChallenges.length + 1;

    const vc = E.challenge("vc", stage, dim, 0);
    vc.expDeg = 0;
    
    let multipleBoundaries = false;
    if(constraints.filter(c => c.boundary !== "everyRow").length > 0) multipleBoundaries = true;
    
    for (let i=0; i<imExps.length; i++) {
        const expId = imExps[i];
        const stageIm = imPolsLastStage ? res.numChallenges.length : expressions[expId].stage;
        expressions[expId].stage = stageIm;
        const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === expId && s.airId === res.airId && s.subproofId === res.subproofId);
        const dim = getExpDim(expressions, expId, stark);
        if(!symbol) {
            symbols.push({ type: "tmpPol", name: `ImPol.${expId}`, expId, polId: res.nCommitments++, stage: stageIm, dim, imPol: true, airId: res.airId, subproofId: res.subproofId });
        } else {
            symbol.imPol = true;
            symbol.expId = expId;
            symbol.polId = res.nCommitments++;
            symbol.stage = stageIm;
        };
        let e = {
            op: "sub",
            values: [
                Object.assign({}, expressions[imExps[i]]),
                E.cm(res.nCommitments-1, 0, stage, dim),
            ]
        };
        if(stark && multipleBoundaries) e = E.mul(E.zi("everyRow"), e);
        expressions[res.cExpId] = E.add(E.mul(vc, expressions[res.cExpId]), e);
    }

    let cExpDim = getExpDim(expressions, res.cExpId, stark);
    expressions[res.cExpId].dim = cExpDim;

    res.qDim = cExpDim;

    if(stark) {
        res.qs = [];
        for (let i=0; i<res.qDeg; i++) {
            res.qs[i] = res.nCommitments++;
            symbols.push({ type: "witness", name: `Q${i}`, polId: res.qs[i], stage: "Q", dim: res.qDim, airId: res.airId, subproofId: res.subproofId });
            E.cm(res.qs[i], 0, stage, res.qDim);
        }
    }
}

module.exports.calculateIntermediatePolynomials = function calculateIntermediatePolynomials(expressions, cExpId, maxQDeg, qDim) {
    let d = 2;

    const cExp = expressions[cExpId];
    let [imExps, qDeg] = calculateImPols(expressions, cExp, d);
    let addedBasefieldCols = calculateAddedCols(d++, expressions, imExps, qDeg, qDim);
    while(imExps.length > 0 && d <= maxQDeg) {
        let [imExpsP, qDegP] = calculateImPols(expressions, cExp, d);
        let newAddedBasefieldCols = calculateAddedCols(d++, expressions, imExpsP, qDegP, qDim);
        if ((maxQDeg && newAddedBasefieldCols < addedBasefieldCols) 
            || (!maxQDeg && imExpsP.length === 0)) {
            addedBasefieldCols = newAddedBasefieldCols;
            [imExps, qDeg] = [imExpsP, qDegP];
        }
        if(imExpsP.length === 0) break;
    }

    return {newExpressions: expressions, imExps, qDeg};
}

function calculateAddedCols(maxDeg, expressions, imExps, qDeg, qDim) {
    let qCols = qDeg * qDim;
    let imCols = 0;
    for(let i = 0; i < imExps.length; i++) {
       imCols += expressions[imExps[i]].dim;
    }
    let addedCols = qCols + imCols;
    console.log(`maxDeg: ${maxDeg}, nIm: ${imExps.length}, d: ${qDeg}, addedCols in the basefield: ${addedCols} (${qCols} + ${imCols})`);

    return addedCols;
}

function calculateImPols(expressions, _exp, maxDeg) {

    const imPols = [];
    const absoluteMax = maxDeg;
    let absMaxD = 0;

    [re, rd] = _calculateImPols(expressions, _exp, imPols, maxDeg);

    return [re, Math.max(rd, absMaxD) - 1];  // We divide the exp polynomial by 1.

    function _calculateImPols(expressions, exp, imPols, maxDeg) {
        if (imPols === false) {
            return [false, -1];
        }

        if (["add", "sub"].indexOf(exp.op) >=0 ) {
            let md = 0;
            for (let i=0; i<exp.values.length; i++) {
                [imPols , d] = _calculateImPols(expressions, exp.values[i], imPols, maxDeg);
                if (d>md) md = d;
            }
            return [imPols, md];
        } else if (exp.op == "mul") {
            let eb = false;
            let ed = -1;
            if(!["add", "mul", "sub", "exp"].includes(exp.values[0].op) && exp.values[0].expDeg === 0) { 
                return _calculateImPols(expressions, exp.values[1], imPols, maxDeg);
            }
            if(!["add", "mul", "sub", "exp"].includes(exp.values[1].op) && exp.values[1].expDeg === 0) { 
                return _calculateImPols(expressions, exp.values[0], imPols, maxDeg);
            }
            const maxDegHere = exp.expDeg;
            if (maxDegHere <= maxDeg) {
                return [imPols, maxDegHere];
            }
            for (let l=0; l<=maxDeg; l++) {
                let r = maxDeg-l;
                const [e1, d1] = _calculateImPols(expressions, exp.values[0], imPols, l);
                const [e2, d2] = _calculateImPols(expressions, exp.values[1], e1, r );
                if(e2 !== false && (eb === false || e2.length < eb.length)) {
                    eb = e2;
                    ed = d1+d2;
                } 
            
                if (eb !== false && eb.length == imPols.length) return [eb, ed];  // Cannot do it better.
            }
            return [eb, ed];
        } else if (exp.op == "exp") {
            if (maxDeg < 1) {
                return [false, -1];
            }
            if (imPols.findIndex(im => im === exp.id) !== -1) return [imPols, 1];
            let e,d;
            if(exp.res && exp.res[absoluteMax] && exp.res[absoluteMax][JSON.stringify(imPols)]) {
                [e,d] = exp.res[absoluteMax][JSON.stringify(imPols)];
            } else {
                [e,d] = _calculateImPols(expressions, expressions[exp.id], imPols, absoluteMax);
            }
            if (e === false) {
                return [false, -1];
            }
            if (d > maxDeg) {
                if (d>absMaxD) absMaxD = d;
                return [[...e, exp.id], 1];
            } else {
                if(!exp.res) exp.res = {};
                if(!exp.res[absoluteMax]) exp.res[absoluteMax] = {};
                exp.res[absoluteMax][JSON.stringify(imPols)] = [e, d];
                return exp.res[absoluteMax][JSON.stringify(imPols)];
            }
        } else {
            if(exp.expDeg === 0) {
                return [imPols, 0];
            } else if (maxDeg < 1) {
                return [false, -1];
            } else {
                return [imPols, 1];
            }
        }
    }
}
