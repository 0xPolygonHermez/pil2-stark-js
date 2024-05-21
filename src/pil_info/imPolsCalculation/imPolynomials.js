
const ExpressionOps = require("../expressionops");

const { getExpDim, addInfoExpressions } = require("../helpers/helpers");

module.exports.addIntermediatePolynomials = function addIntermediatePolynomials(res, expressions, constraints, symbols, imExps, qDeg, stark) {
    const E = new ExpressionOps();

    console.log("Number of intermediate expressions: " + imExps.length);
    console.log("Q degree: " + qDeg);
    
    res.qDeg = qDeg;

    const dim = stark ? 3 : 1;
    const stage = res.nStages + 1;

    const vc_id = symbols.filter(s => s.type === "challenge" && s.stage < stage).length;

    const vc = E.challenge("std_vc", stage, dim, 0, vc_id);
    vc.expDeg = 0;

    const polQDeg = module.exports.calculateExpDeg(expressions, expressions[res.cExpId], imExps || []);
    if(polQDeg > qDeg + 1) {
        throw new Error(`The polinomial Q has a higher degree ${polQDeg} than the maximum allowed degree ${qDeg + 1}`);
    }

    for (let i=0; i<imExps.length; i++) {
        const expId = imExps[i];
        
        const imPolDeg = module.exports.calculateExpDeg(expressions, expressions[expId], imExps);
        if(imPolDeg > qDeg + 1) {
            throw new Error(`Intermediate polynomial with id: ${expId} has a higher degree ${imPolDeg} than the maximum allowed degree ${qDeg + 1}`);
        }

        const stageIm = res.imPolsStages ? expressions[expId].stage : res.nStages;
                
        const dim = getExpDim(expressions, expId, stark);
          
        const symbol = symbols.find(s => s.type === "tmpPol" && s.expId === expId && s.airId === res.airId && s.subproofId === res.subproofId);
        if(!symbol) {
            symbols.push({ type: "tmpPol", name: `ImPol.${expId}`, expId, polId: res.nCommitments++, stage: stageIm, dim, imPol: true, airId: res.airId, subproofId: res.subproofId });
        } else {
            symbol.imPol = true;
            symbol.expId = expId;
            symbol.polId = res.nCommitments++;
            symbol.stage = stageIm;
        };
        
        expressions[expId].imPol = true;
        expressions[expId].polId = res.nCommitments - 1;
        expressions[expId].keep = true;

        let e = {
            op: "sub",
            values: [
                Object.assign({}, expressions[imExps[i]]),
                E.cm(res.nCommitments-1, 0, stageIm, dim),
            ]
        };
        expressions.push(e);
        addInfoExpressions(expressions, e, stark);

        constraints.push({ e: expressions.length - 1, boundary: "everyRow", filename: `ImPol.${expId}`, line: `ImPol.${expId}`, stage: expressions[expId].stage });
        
        expressions[res.cExpId] = E.add(E.mul(vc, expressions[res.cExpId]), e);
    }

    expressions[res.cExpId] = E.mul(expressions[res.cExpId], E.zi(res.boundaries.findIndex(b => b.name === "everyRow")));

    let cExpDim = getExpDim(expressions, res.cExpId, stark);
    expressions[res.cExpId].dim = cExpDim;

    res.qDim = cExpDim;

    if(stark) {
        for (let i=0; i<res.qDeg; i++) {
            const index = res.nCommitments++;
            symbols.push({ type: "witness", name: `Q${i}`, polId: index, stage, dim: res.qDim, airId: res.airId, subproofId: res.subproofId });
            E.cm(index, 0, stage, res.qDim);
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

module.exports.calculateExpDeg = function calculateExpDeg(expressions, exp, imExps = []) {
    if (exp.op == "exp") {
        if (imExps.includes(exp.id)) return 1;
        return calculateExpDeg(expressions, expressions[exp.id], imExps);
    } else if (["x", "const", "cm"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        return 1;
    } else if (["number", "public", "challenge", "eval", "subproofValue"].includes(exp.op) || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        return 0;
    } else if(exp.op === "neg") {
        return calculateExpDeg(expressions, exp.values[0], imExps);
    } else if(["add", "sub", "mul"].includes(exp.op)) {
        const lhsDeg = calculateExpDeg(expressions, exp.values[0], imExps);
        const rhsDeg = calculateExpDeg(expressions, exp.values[1], imExps);
        return exp.op === "mul" ? lhsDeg + rhsDeg : Math.max(lhsDeg, rhsDeg);
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }
}
