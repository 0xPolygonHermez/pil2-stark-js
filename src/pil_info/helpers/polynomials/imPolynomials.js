
module.exports.calculateIntermediatePolynomials = function calculateIntermediatePolynomials(expressions, cExpId, maxQDeg) {
    let d = 2;

    const cExp = expressions[cExpId];
    let [imExps, qDeg] = calculateImPols(expressions, cExp, d++);
    while(imExps.length > 0 && d <= maxQDeg) {
        let [imExpsP, qDegP] = calculateImPols(expressions, cExp, d++);
        if ((maxQDeg && imExpsP.length + qDegP < imExps.length + qDeg) 
            || (!maxQDeg && imExpsP.length === 0)) {
            [imExps, qDeg] = [imExpsP, qDegP];
        }
        if(imExpsP.length === 0) break;
    }

    return {newExpressions: expressions, imExps, qDeg};
}


function calculateImPols(expressions, _exp, maxDeg) {

    const imPols = [];
    const absoluteMax = maxDeg;
    let absMaxD = 0;

    [re, rd] = _calculateImPols(expressions, _exp, imPols, maxDeg);

    console.log(`maxDeg: ${maxDeg}, nIm: ${re.length}, d: ${rd}`);

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