const ExpressionOps = require("../expressionops");

module.exports = function generateConstraintPolynomial(res, expressions, constraints, stark) {

    const E = new ExpressionOps();

    const vc = E.challenge("vc", res.nLibStages + 2);
    res.challengesMap.push({stage: "Q", stageId: 0, name: "vc", globalId: vc.id});

    if(stark) {
        const xi = E.challenge("xi", res.nLibStages + 3);
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
        E.cm(res.nCommitments-1, false, res.nLibStages + 1);
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
            E.cm(res.nCommitments-1, false, res.nLibStages + 2);
        }
    }
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
    if(exp.expDeg) return;

    if (exp.op == "exp") {
        if (expressions[exp.id].expDeg) {
            exp.expDeg = expressions[exp.id].expDeg;
            exp.stage = expressions[exp.id].stage;
        }
        if (!exp.expDeg) {
            calculateDegreeExpressions(expressions, expressions[exp.id]);
            exp.expDeg = expressions[exp.id].expDeg;
            exp.stage = expressions[exp.id].stage;
        }
    } else if (["x", "cm", "const"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        exp.expDeg = 1;
        if(exp.op !== "cm") {
            exp.stage = 0; 
        } else if(!exp.stage) {
            exp.stage = 1;
        }
    } else if (["number", "challenge", "public", "eval"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
        if(exp.op !== "challenge") exp.stage = 0; 
    } else if(exp.op == "neg") {
        calculateDegreeExpressions(expressions, exp.values[0]);
        exp.expDeg = exp.values[0].expDeg;
        exp.stage = exp.values[0].stage;
    } else if(["add", "sub", "mul"].includes(exp.op)) {
        calculateDegreeExpressions(expressions, exp.values[0]);
        calculateDegreeExpressions(expressions, exp.values[1]);
        const lhsDeg = exp.values[0].expDeg;
        const rhsDeg = exp.values[1].expDeg;
        if(exp.op === "mul") {
            exp.expDeg = lhsDeg + rhsDeg;
        } else {
            exp.expDeg = Math.max(lhsDeg, rhsDeg);
        }
        exp.stage = Math.max(exp.values[0].stage, exp.values[1].stage);
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }

    return;
}
