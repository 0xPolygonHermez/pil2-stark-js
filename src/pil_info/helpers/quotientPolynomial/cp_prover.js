const {pilCodeGen, buildCode} = require("../../codegen.js");
const ExpressionOps = require("../../expressionops");

module.exports = function generateConstraintPolynomial(res, expressions, constraints, ctx, ctxExt, stark) {

    const E = new ExpressionOps();

    const vc = E.challenge("vc");
    res.challengesMap.push({stage: "Q", stageId: 0, name: "vc", globalId: vc.id});

    if(stark) {
        const xi = E.challenge("xi");
        res.challengesMap.push({stage: "evals", stageId: 0, name: "xi", globalId: xi.id});
    }

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
        calculateDegreeExpressions(expressions, expressions[constraints[i].e]);
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
    res.imPolsMap = {};
    for (let i=0; i<imExpsList.length; i++) {
        res.imPolsMap[imExpsList[i]] = {id: res.nCommitments++, imPol: true};
        let e = {
            op: "sub",
            values: [
                Object.assign({}, expressions[imExpsList[i]]),
                {
                    op: "cm",
                    id: res.nCommitments-1
                }
            ]
        };
        if(stark) e = E.mul(E.zi("everyRow"), e);
        if (cExp) {
            cExp = E.add(E.mul(vc, cExp), e);
        } else {
            cExp = e;
        }
    }

    res.cExp = expressions.length;
    expressions.push(cExp);
    
    if(stark) {
        res.qs = [];
        for (let i=0; i<res.qDeg; i++) {
            res.qs[i] = res.nCommitments++;
        }
    }

    for (let i=0; i<imExpsList.length; i++) {
        pilCodeGen(ctx, expressions, constraints, imExpsList[i], 0);
    }

    res.code["imPols"] = buildCode(ctx, expressions);

    for(let i = 0; i < Object.keys(res.imPolsMap).length; i++) {
        const expId = Object.keys(res.imPolsMap)[i];
        ctxExt.calculated[expId] = {};
        ctxExt.calculated[expId][0] = true;
        ctxExt.calculated[expId][1] = true;
    }

    pilCodeGen(ctxExt, expressions, constraints, res.cExp, 0);
    const code = ctxExt.code[ctxExt.code.length-1].code;
    code[code.length-1].dest = {type: "q", id: 0};

    res.code["Q"] = buildCode(ctxExt, expressions);
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

function calculateDegreeExpressions(expressions, exp) {
    if(exp.expDeg) return exp.expDeg;

    if (exp.op == "exp") {
        if (expressions[exp.id].expDeg) exp.expDeg = expressions[exp.id].expDeg;
        if (!exp.expDeg) exp.expDeg = calculateDegreeExpressions(expressions, expressions[exp.id]);
    } else if (["x", "cm", "const"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        exp.expDeg = 1;
    } else if (["number", "challenge", "public", "eval"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
    } else if(exp.op == "neg") {
        exp.expDeg = calculateDegreeExpressions(expressions, exp.values[0]);
    } else if(["add", "sub", "mul"].includes(exp.op)) {
        const lhsDeg = calculateDegreeExpressions(expressions, exp.values[0]);
        const rhsDeg = calculateDegreeExpressions(expressions, exp.values[1]);
        if(exp.op === "mul") {
            exp.expDeg = lhsDeg + rhsDeg;
        } else {
            exp.expDeg = Math.max(lhsDeg, rhsDeg);
        }
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }

    return exp.expDeg;
}
