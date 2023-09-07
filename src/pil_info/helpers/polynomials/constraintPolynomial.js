const ExpressionOps = require("../../expressionops");
const { getExpDim } = require("../helpers");

module.exports = function generateConstraintPolynomial(res, symbols, expressions, constraints, stark) {

    const E = new ExpressionOps();

    const dim = stark ? 3 : 1;
    const stage = res.numChallenges.length + 1;

    let vcSymbol = symbols.find(s => s.type === "challenge" && s.stage === stage && s.stageId === 0);
    let vcId = symbols.filter(s => s.type === "challenge" && ((s.stage < stage) || (s.stage == stage && s.stageId < vcSymbol.stageId))).length;
    const vc = E.challenge("vc", stage, dim, vcId);

    res.boundaries = ["everyRow"];

    res.constraintFrames = [];
    
    let cExp = null;
    for (let i=0; i<constraints.length; i++) {
        const boundary = constraints[i].boundary;
        if(!["everyRow", "firstRow", "lastRow", "everyFrame"].includes(boundary)) throw new Error("Boundary " + boundary + " not supported");
        if(!res.boundaries.includes(boundary)) res.boundaries.push(boundary);
        let zi;
        if(boundary === "everyFrame") {
            let frameId = res.constraintFrames.findIndex(f => f.offsetMin ===  constraints[i].offsetMin && f.offsetMax === constraints[i].offsetMax);
            if(frameId == -1) {
                res.constraintFrames.push({offsetMin: constraints[i].offsetMin, offsetMax: constraints[i].offsetMax})
                frameId = res.constraintFrames.length - 1;
            }
            zi = E.zi(boundary, frameId);
        } else {
            zi = E.zi(boundary);
        }
        let e = E.exp(constraints[i].e);
        if(stark) e = E.mul(zi, e);
        if (cExp) {
            cExp = E.add(E.mul(vc, cExp), e);
        } else {
            cExp = e;
        }
    }

    let maxDeg;
    if(stark) {
        maxDeg = (1 << (res.starkStruct.nBitsExt- res.starkStruct.nBits)) + 1;
    } else {
        maxDeg = Math.pow(2,3) + 1;
    }
    let d = 2;
    let [imExps, qDeg] = calculateImPols(expressions, cExp, d++);
    while(Object.keys(imExps).length > 0 && d <= maxDeg) {
        let [imExpsP, qDegP] = calculateImPols(expressions, cExp, d++);
        if ((maxDeg && (Object.keys(imExpsP).length + qDegP < Object.keys(imExps).length + qDeg)) 
            || (!maxDeg && Object.keys(imExpsP).length === 0)) {
            [imExps, qDeg] = [imExpsP, qDegP];
        }
        if(Object.keys(imExpsP).length === 0) break;
    }

    console.log("Number of intermediate expressions: " + Object.keys(imExps).length);
    console.log("Q degree: " + qDeg);

    res.qDeg = qDeg;

    let imExpsList = Object.keys(imExps).map(Number);
    for (let i=0; i<imExpsList.length; i++) {
        const expId = imExpsList[i];
        const stage = expressions[expId].stage;
        const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === expId);
        const dim = getExpDim(expressions, expId, stark);
        if(!symbol) {
            symbols.push({ type: "tmpPol", name: `ImPol.${expId}`, expId, polId: res.nCommitments++, stage, dim, imPol: true });
        } else {
            symbol.imPol = true;
            symbol.expId = expId;
            symbol.polId = res.nCommitments++;
        };
        let e = {
            op: "sub",
            values: [
                Object.assign({}, expressions[imExpsList[i]]),
                E.cm(res.nCommitments-1, 0, stage, dim),
            ]
        };
        if(stark) e = E.mul(E.zi("everyRow"), e);
        if (cExp) {
            cExp = E.add(E.mul(vc, cExp), e);
        } else {
            cExp = e;
        }
    }

    let cExpId = expressions.length;
    expressions.push(cExp);
    let cExpDim = getExpDim(expressions, cExpId, stark);
    expressions[cExpId].dim = cExpDim;

    res.qDim = cExpDim;

    if(stark) {
        res.qs = [];
        for (let i=0; i<res.qDeg; i++) {
            res.qs[i] = res.nCommitments++;
            symbols.push({ type: "witness", name: `Q${i}`, polId: res.qs[i], stage: "Q", dim: res.qDim });
            E.cm(res.qs[i], 0, stage, res.qDim);
        }
    }

    return cExpId;
}

function calculateImPols(expressions, _exp, maxDeg) {

    const imPols = {};
    const absoluteMax = maxDeg;
    let absMaxD = 0;

    [re, rd] = _calculateImPols(expressions, _exp, imPols, maxDeg);

    console.log(`maxDeg: ${maxDeg}, nIm: ${Object.keys(re).length}, d: ${rd}`);

    return [re, Math.max(rd, absMaxD) - 1];  // We divide the exp polynomial by 1.

    function _calculateImPols(expressions, exp, imPols, maxDeg) {
        if (imPols === false) {
            return [false, -1];
        }
        if (exp.op === "neg") {
            return _calculateImPols(expressions, exp.values[0], imPols, maxDeg);
        } else if (["add", "sub"].indexOf(exp.op) >=0 ) {
            let md = 0;
            for (let i=0; i<exp.values.length; i++) {
                [imPols , d] = _calculateImPols(expressions, exp.values[i], imPols, maxDeg);
                if (d>md) md = d;
            }
            return [imPols, md];
        } else if (["number", "public", "challenge"].indexOf(exp.op) >=0 || (exp.op === "Zi" && exp.boundary === "everyRow")) {
            return [imPols, 0];
        } else if (["x", "const", "cm"].indexOf(exp.op) >= 0 || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
            if (maxDeg < 1) return [false, -1];
            return [imPols, 1];
        } else if (exp.op == "mul") {
            let eb = false;
            let ed = -1;
            if (["number", "public", "challenge"].indexOf(exp.values[0].op) >= 0 ) {
                return _calculateImPols(expressions, exp.values[1], imPols, maxDeg);
            }
            if (["number", "public", "challenge"].indexOf(exp.values[1].op) >= 0 ) {
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
                if(e2 !== false && (eb === false || Object.keys(e2).length < Object.keys(eb).length)) {
                    eb = e2;
                    ed = d1+d2;
                } 
            
                if (eb !== false && Object.keys(eb).length == Object.keys(imPols).length) return [eb, ed];  // Cannot do it better.
            }
            return [eb, ed];
        } else if (exp.op == "exp") {
            if (maxDeg < 1) {
                return [false, -1];
            }
            if (imPols[exp.id]) return [imPols, 1];
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
                const ce = Object.assign({}, e);
                ce[exp.id] = true;
                if (d>absMaxD) absMaxD = d;
                return [ce, 1];
            } else {
                if(!exp.res) exp.res = {};
                if(!exp.res[absoluteMax]) exp.res[absoluteMax] = {};
                exp.res[absoluteMax][JSON.stringify(imPols)] = [e, d];
                return exp.res[absoluteMax][JSON.stringify(imPols)];
            }
        } else {
            throw new Error("Exp op not defined: "+ exp.op);
        }
    }

}
