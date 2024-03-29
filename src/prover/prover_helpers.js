const workerpool = require("workerpool");
const {BigBuffer} = require("ffjavascript");
const { starkgen_execute } = require("./stark_prover_worker");
const { fflonkgen_execute } = require("./fflonk_prover_worker");

const maxNperThread = 1<<18;
const minNperThread = 1<<12;

module.exports.callCalculateExps = async function callCalculateExps(step, code, dom, ctx, parallelExec, useThreads, debug, global = false) {
    if (parallelExec) {
        await module.exports.calculateExpsParallel(ctx, step, code, useThreads, debug);
    } else {
        module.exports.calculateExps(ctx, code, dom, debug, false, global);
    }
}

module.exports.calculateExps = function calculateExps(ctx, code, dom, debug, ret, global) {
    ctx.tmp = new Array(code.tmpUsed);

    const retValue = debug || ret || false;
    cEveryRow = new Function("ctx", "i", module.exports.compileCode(ctx, code.code, dom, retValue, global));

    const N = dom=="n" ? ctx.N : ctx.extN;
    
    const pCtx = ctxProxy(ctx);

    const res = [];
    if(!debug) {
        for (let i=0; i<N; i++) {
            res[i] = cEveryRow(pCtx, i);
        }
    } else {
        let first, last;
        if(code.boundary === "everyRow") {
            first = 0;
            last = N;
        } else if(code.boundary === "firstRow" || code.boundary === "finalProof") {
            first = 0;
            last = 1;
        } else if(code.boundary === "lastRow") {
            first = N-1;
            last = N;
        } else if(code.boundary === "everyFrame") {
            first = code.offsetMin;
            last = N - code.offsetMax;
        } else throw new Error("Invalid boundary: " + code.boundary);

        for(let i = first; i < last; i++) {
            const v = cEveryRow(pCtx, i);
            if (!pCtx.F.isZero(v)) {
                pCtx.errors.push(`${code.filename}:${code.line}: identity does not match w=${i} val=${pCtx.F.toString(v)} `);
                return;
            }
        }
    }
    if(ret) return res;
}

module.exports.calculateExpAtPoint = function calculateExpAtPoint(ctx, code, i) {
    ctx.tmp = new Array(code.tmpUsed);
    cEveryRow = new Function("ctx", "i", module.exports.compileCode(ctx, code.code, "n", true));

    const pCtx = ctxProxy(ctx);
    return cEveryRow(pCtx, i);
}


module.exports.compileCode = function compileCode(ctx, code, dom, ret, global) {
    const body = [];

    for (let j=0;j<code.length; j++) {
        const src = [];
        for (k=0; k<code[j].src.length; k++) {
            src.push(module.exports.getRef(code[j].src[k], ctx, dom, global));
        }
        let exp;
        switch (code[j].op) {
            case 'add': exp = `ctx.F.add(${src[0]}, ${src[1]})`; break;
            case 'sub': exp = `ctx.F.sub(${src[0]}, ${src[1]})`; break;
            case 'mul': exp = `ctx.F.mul(${src[0]}, ${src[1]})`; break;
            case 'copy': exp = `${src[0]}`; break;
            default: throw new Error("Invalid op:"+ code[j].op);
        }
        module.exports.setRef(ctx, body, code[j].dest, exp, dom);
    }

    if (ret) {
        body.push(`  return ${module.exports.getRef(code[code.length-1].dest, ctx, dom, global)};`);
    }

    return body.join("\n");
}

module.exports.setRef = function setRef(ctx, body, r, val, dom) {
    switch (r.type) {
        case "tmp": {
            body.push(`  ctx.tmp[${r.id}] = ${val};`);
            break;
        }
        case "q":
            if (dom=="n") {
                throw new Error("Accessing q in domain n");
            } else if (dom=="ext") {
                if (r.dim == 3) {
                    body.push(` [ ctx.q_ext[i*3], ctx.q_ext[i*3+1], ctx.q_ext[i*3+2]] = ${val}; `);
                } else if (r.dim == 1) {
                    body.push(`ctx.q_ext[i] = ${val}`);
                } else {
                    throw new Error("Invalid dom");
                }
            } else {
                throw new Error("Invalid dom");
            }
            break;
        case "f":
            if (dom=="n") {
                throw new Error("Accessing q in domain n");
            } else if (dom=="ext") {
                body.push(`[ ctx.f_ext[i*3], ctx.f_ext[i*3+1], ctx.f_ext[i*3+2]] = ${val};`);
            } else {
                throw new Error("Invalid dom");
            }
            break;
        case "cm":
            if (dom=="n") {
                body.push(` ${evalMap(ctx, r.id, r.prime, dom, val)};`);
            } else if (dom=="ext") {
                body.push(` ${evalMap(ctx, r.id, r.prime, dom, val)};`);
            } else {
                throw new Error("Invalid dom");
            }
            break;
        default: throw new Error("Invalid reference type set: " + r.type);
    }
}

module.exports.getRef = function getRef(r, ctx, dom, global) {
    switch (r.type) {
        case "tmp": return `ctx.tmp[${r.id}]`;
        case "const": {
            const N = dom === "n" ? ctx.N : ctx.extN;
            let next;
            if(dom === "n") {
                next = r.prime < 0 ? r.prime + N : r.prime;
            } else {
                next = r.prime < 0 ? (r.prime + N) << ctx.extendBits : r.prime << ctx.extendBits;
            }
            const index = r.prime ? `((i + ${next})%${N})` : "i"
            if (dom === "n") {
                return `ctx.const_n[${r.id} + ${index} * ${ctx.pilInfo.nConstants}]`;
            } else if (dom === "ext") {
                return `ctx.const_ext[${r.id} + ${index} * ${ctx.pilInfo.nConstants}]`;
            } else {
                throw new Error("Invalid dom");
            }
        }
        case "cm": {
            if (dom=="n") {
                return evalMap(ctx, r.id, r.prime, dom)
            } else if (dom=="ext") {
                return evalMap(ctx, r.id, r.prime, dom)
            } else {
                throw new Error("Invalid dom");
            }
        }
        case "number": return `ctx.F.e(${r.value}n)`;
        case "public": return `ctx.publics[${r.id}]`;
        case "challenge": return `ctx.challenges[${r.stage - 1}][${r.stageId}]`;
        case "subproofValue": return global ? `ctx.subAirValues[${r.subproofId}][${r.id}]` : `ctx.subAirValues[${r.id}]`;
        case "eval": return `ctx.evals[${r.id}]`;
        case "xDivXSubXi": {
            return `[
                ctx.xDivXSubXi_ext[3*(${r.id} + ${ctx.pilInfo.openingPoints.length}*i)], 
                ctx.xDivXSubXi_ext[3*(${r.id} + ${ctx.pilInfo.openingPoints.length}*i) + 1], 
                ctx.xDivXSubXi_ext[3*(${r.id} + ${ctx.pilInfo.openingPoints.length}*i) + 2]
            ]`;
        }
        case "x": {
            if (dom=="n") {
                return `ctx.x_n[i]`;
            } else if (dom === "ext") {
                return `ctx.x_ext[i]`;
            } else {
                throw new Error("Invalid dom");
            }
        }
        case "Zi": {
            const boundary = ctx.pilInfo.boundaries[r.boundaryId];
            if(boundary.name === "everyFrame") {
                const ziIndex = ctx.pilInfo.boundaries.findIndex(b => b.name === "everyFrame" && b.offsetMin === boundary.offsetMin && b.offsetMax === boundary.offsetMax);
                if(ziIndex === -1) throw new Error("Something went wrong");
                return `ctx.Zi_ext[${ziIndex} * ${ctx.extN} + i]`;
            } else if(["everyRow", "firstRow", "lastRow"].includes(boundary.name)) {
                const ziIndex = ctx.pilInfo.boundaries.findIndex(b => b.name === boundary.name);
                if(ziIndex === -1) throw new Error("Something went wrong");
                return `ctx.Zi_ext[${ziIndex} * ${ctx.extN} + i]`;
            } else {
                throw new Error("Invalid boundary: " + boundary.name);
            }
        }
        default: throw new Error("Invalid reference type get: " + r.type);
    }
}

function evalMap(ctx, polId, prime, dom, val) {
    let p = module.exports.getPolRef(ctx, polId, dom);
    let offset = p.offset;
    const N = dom === "n" ? ctx.N : ctx.extN;
    let next;
    if(dom === "n") {
        next = prime < 0 ? prime + N : prime;
    } else {
        next = prime < 0 ? (prime + N) << ctx.extendBits : prime << ctx.extendBits;
    }
    let index = prime ? `((i + ${next})%${N})` : "i";
    let stage = p.stage;
    let size = ctx.pilInfo.mapSectionsN[stage];
    let pos = `${offset} + ${index} * ${size}`;
    if(val) {
        if (p.dim == 1) {
            return `ctx.${stage}[${pos}] = ${val};`;
        } else if (p.dim == 3) {
            return `[` +
                ` ctx.${stage}[${pos}],`+
                ` ctx.${stage}[${pos} + 1],`+
                ` ctx.${stage}[${pos} + 2] `+
                `] = ${val};`;
        } else {
            throw new Error("invalid dim");
        }
    } else {
        if (p.dim == 1) {
            return `ctx.${stage}[${pos}]`;
        } else if (p.dim == 3) {
            return `[` +
                ` ctx.${stage}[${pos}] ,`+
                ` ctx.${stage}[${pos} + 1],`+
                ` ctx.${stage}[${pos} + 2] `+
                `]`;
        } else {
            throw new Error("invalid dim");
        }
    }
}

module.exports.setPol = function setPol(ctx, idPol, pol, dom) {
    const p = module.exports.getPolRef(ctx, idPol, dom);

    if (p.dim == 1) {
        let buildPol = ctx.prover === "stark"
            ? new Function("ctx", "i", "pol", [`ctx.${p.stage}.setElement(${p.offset} + i * ${p.size},pol);`])
            : new Function("ctx", "i", "pol", [`ctx.${p.stage}.set(pol, (${p.offset} + i * ${p.size})*ctx.F.n8);`]);
        for (let i=0; i<p.deg; i++) {
            buildPol(ctx, i, pol[i]);
        }
    } else if (p.dim == 3) {
        const buildPolCode = [];
        if(ctx.prover === "stark") {
            buildPolCode.push(`ctx.${p.stage}.setElement(${p.offset} + i * ${p.size},pol[0]);`);
            buildPolCode.push(`ctx.${p.stage}.setElement(${p.offset} + i * ${p.size} + 1,pol[1]);`);
            buildPolCode.push(`ctx.${p.stage}.setElement(${p.offset} + i * ${p.size} + 2,pol[2]);`);
        } else {
            buildPolCode.push(`ctx.${p.stage}.set(pol[0], (${p.offset} + i * ${p.size})*ctx.F.n8);`);
            buildPolCode.push(`ctx.${p.stage}.set(pol[1], (${p.offset} + i * ${p.size} + 1)*ctx.F.n8);`);
            buildPolCode.push(`ctx.${p.stage}.set(pol[2], (${p.offset} + i * ${p.size} + 2)*ctx.F.n8);`);
        }
    
        let buildPol = new Function("ctx", "i", "pol", buildPolCode.join("\n"));
    
        for (let i=0; i<p.deg; i++) {
            if (Array.isArray(pol[i])) {
                buildPol(ctx, i, pol[i]);
            } else {
                buildPol(ctx, i, [pol[i], 0n, 0n]);
            }
        }
    } else {
        throw new Error("invalid dim" + p.dim)
    }
}

module.exports.getPolRef = function getPolRef(ctx, idPol, dom) {
    if(!["n", "ext"].includes(dom)) throw new Error("invalid stage");
    const deg = dom === "ext" ? ctx.extN : ctx.N;
    let p = ctx.pilInfo.cmPolsMap[idPol];
    let stage = p.stage + "_" + dom;
    let offset = p.stagePos;
    let polRef = {
        stage,
        buffer: ctx[stage],
        deg,
        offset,
        size: ctx.pilInfo.mapSectionsN[stage],
        dim: p.dim
    };
    return polRef;
}

module.exports.getPol = function getPol(ctx, idPol, dom) {
    const p = module.exports.getPolRef(ctx, idPol, dom);
    const res = new Array(p.deg);
    if (p.dim == 1) {
        let buildPol = ctx.prover === "stark" 
            ? new Function("ctx", "i", "res", [`res[i] = ctx.${p.stage}.getElement(${p.offset} + i * ${p.size});`])
            : new Function("ctx", "i", "res", [`res[i] = ctx.${p.stage}.slice((${p.offset} + i * ${p.size}) * ctx.F.n8, (${p.offset} + i * ${p.size} + 1) * ctx.F.n8);`]);
        for (let i=0; i<p.deg; i++) {
            buildPol(ctx, i, res);
        }
    } else if (p.dim == 3) {
        const buildPolCode = [];
        if(ctx.prover === "stark") {
            buildPolCode.push(`res[i] = [ctx.${p.stage}.getElement(${p.offset} + i * ${p.size}), 
                                        ctx.${p.stage}.getElement(${p.offset} + i * ${p.size} + 1),
                                        ctx.${p.stage}.getElement(${p.offset} + i * ${p.size} + 2)];`);
        } else {
            buildPolCode.push(`res[i] = [ctx.${p.stage}.slice((${p.offset} + i * ${p.size}) * ctx.F.n8, (${p.offset} + i * ${p.size} + 1) * ctx.F.n8), 
                ctx.${p.stage}.slice((${p.offset} + i * ${p.size} + 1) * ctx.F.n8, (${p.offset} + i * ${p.size} + 2) * ctx.F.n8),
                ctx.${p.stage}.slice((${p.offset} + i * ${p.size} + 2) * ctx.F.n8, (${p.offset} + i * ${p.size} + 3) * ctx.F.n8)];`);
        }
    
        let buildPol = new Function("ctx", "i", "res", buildPolCode.join("\n"));

        for (let i=0; i<p.deg; i++) {
            buildPol(ctx, i, res);
        }
    } else {
        throw new Error("invalid dim" + p.dim)
    }
    return res;
}


module.exports.calculateExpsParallel = async function calculateExpsParallel(ctx, execPart, code, useThreads, debug) {

    const pool = workerpool.pool(__dirname + '/prover_worker.js');

    let dom;
    let execInfo = {
        inputSections: [],
        outputSections: []
    };

    if(execPart !== "global") {
        const execStages = [];
        for(let i = 0; i < ctx.pilInfo.numChallenges.length; ++i) {
            const stage = 1 + i;
            execStages.push(`stage${stage}`);
        }

        const qStage = ctx.pilInfo.numChallenges.length + 1;

        if (execStages.includes(execPart)) {
            execInfo.inputSections.push({ name: "const_n" });
            execInfo.inputSections.push({ name: "x_n" });
            for(let j = 0; j < ctx.pilInfo.numChallenges.length; j++) {
                const stage = j + 1;
                execInfo.inputSections.push({ name: `cm${stage}_n` });
                execInfo.outputSections.push({ name: `cm${stage}_n` });
            }
            execInfo.inputSections.push({ name: "tmpExp_n" });
            execInfo.outputSections.push({ name: "tmpExp_n" });
            dom = "n";
        } else if (execPart === "qCode") {
            execInfo.inputSections.push({ name: "const_ext" });
            for(let i = 0; i < ctx.pilInfo.numChallenges.length; i++) {
                const stage = i + 1;
                execInfo.inputSections.push({ name: `cm${stage}_ext` });
            }
            execInfo.inputSections.push({ name: "x_ext" });
            execInfo.outputSections.push({ name: "q_ext" });
            if(ctx.prover === "stark") {
                execInfo.inputSections.push({ name: "Zi_ext" });
            }
            dom = "ext";
        } else if (execPart == "fri") {
            execInfo.inputSections.push({ name: "const_ext" });
            for(let i = 0; i < ctx.pilInfo.numChallenges.length + 1; i++) {
                const stage = i + 1;
                execInfo.inputSections.push({ name: `cm${stage}_ext` });
            }
            execInfo.inputSections.push({ name: "xDivXSubXi_ext" });
            execInfo.outputSections.push({ name: "f_ext" });
            dom = "ext";
        } else {
            throw new Error("Exec type not defined " + execPart);
        }
    }

    function setWidth(stage) {
        if ((stage.name == "const_n") || (stage.name == "const_ext")) {
            stage.width = ctx.pilInfo.nConstants;
        } else if (typeof ctx.pilInfo.mapSectionsN[stage.name.split("_")[0]] != "undefined") {
            stage.width = ctx.pilInfo.mapSectionsN[stage.name.split("_")[0]];
        } else if (["x_n", "x_ext"].indexOf(stage.name) >= 0) {
            stage.width = 1;
        } else if (stage.name === "Zi_ext") {
            stage.width = ctx.pilInfo.boundaries.length;
        } else if (["xDivXSubXi_ext"].indexOf(stage.name) >= 0) {
            stage.width = 3*ctx.pilInfo.openingPoints.length;
        } else if (["f_ext"].indexOf(stage.name) >= 0) {
            stage.width = 3;
        } else if (["q_ext"].indexOf(stage.name) >= 0) {
            stage.width = ctx.pilInfo.qDim;
        } else {
            throw new Error("Invalid stage name " + stage.name);
        }
    }

    for (let i = 0; i < execInfo.inputSections.length; i++) setWidth(execInfo.inputSections[i]);
    for (let i = 0; i < execInfo.outputSections.length; i++) setWidth(execInfo.outputSections[i]);

    const cEveryRow = module.exports.compileCode(ctx, code.code, dom, debug);

    const N = dom === "n" ? ctx.N : ctx.extN;

    let first, last;
    if(debug) {
        if(code.boundary === "everyRow") {
            first = 0;
            last = N;
        } else if(code.boundary === "firstRow" || code.boundary === "finalProof") {
            first = 0;
            last = 1;
        } else if(code.boundary === "lastRow") {
            first = N-1;
            last = N;
        } else if(code.boundary === "everyFrame") {
            first = code.offsetMin;
            last = N - code.offsetMax;
        } else throw new Error("Invalid boundary: " + code.boundary);
    } else {
        first = 0;
        last = N;
    }

    let nPerThread = Math.floor((N - 1) / pool.maxWorkers) + 1;
    if (nPerThread > maxNperThread) nPerThread = maxNperThread;
    if (nPerThread < minNperThread) nPerThread = minNperThread;
    const promises = [];
    let res = [];
    const stark = ctx.prover === "stark" ? true : false;
    if(stark) {
        for (let i = 0; i < N; i += nPerThread) {
            const curN = Math.min(nPerThread, N - i);
            const ctxIn = {
                evals: ctx.evals,
                publics: ctx.publics,
                challenges: ctx.challenges,
                subAirValues: ctx.subAirValues
            };
            if(debug) {
                ctxIn.filename = code.filename;
                ctxIn.line = code.line;
            }
            for (let s = 0; s < execInfo.inputSections.length; s++) {
                const si = execInfo.inputSections[s];
                ctxIn[si.name] = new BigUint64Array(curN * si.width);
                const s1 = ctx[si.name].slice(i * si.width, (i + curN) * si.width);
                ctxIn[si.name].set(s1);
            }
    
            for (let s=0; s<execInfo.outputSections.length; s++) {
                const si = execInfo.outputSections[s];
                const b = new BigUint64Array(res[i][si.name].buffer, res[i][si.name].byteOffset, res[i][si.name].length-si.width*next );
                ctx[si.name].set(b , i*nPerThread*si.width);
            }
    
            if (useThreads) {
                promises.push(pool.exec("starkgen_execute", [ctxIn, true, cEveryRow, curN, execInfo, execPart, first, last, debug]));
            } else {
                res.push(await starkgen_execute(ctxIn, true, cEveryRow, curN, execInfo, execPart, first, last, debug));
            }
        }
        if (useThreads) {
            res = await Promise.all(promises)
        }
        for (let i = 0; i < res.length; i++) {
            for (let s = 0; s < execInfo.outputSections.length; s++) {
                const si = execInfo.outputSections[s];
                const b = new BigUint64Array(res[i][si.name].buffer, res[i][si.name].byteOffset, res[i][si.name].length);
                ctx[si.name].set(b, i * nPerThread * si.width);
            }
        }
    } else {
        for (let i = 0; i < N; i += nPerThread) {
            const curN = Math.min(nPerThread, N - i);
            const ctxIn = {
                F: ctx.F,
                evals: ctx.evals,
                publics: ctx.publics,
                challenges: ctx.challenges
            };
            if(debug) {
                ctxIn.filename = code.filename;
                ctxIn.line = code.line;
            }
            for (let s = 0; s < execInfo.inputSections.length; s++) {
                const si = execInfo.inputSections[s];
                ctxIn[si.name] = new BigBuffer(curN * si.width * ctx.F.n8);
                const s1 = si.width > 0 ? ctx[si.name].slice(i * si.width * ctx.F.n8, (i + curN) * si.width * ctx.F.n8) : ctx[si.name];
                ctxIn[si.name].set(s1, 0);
            }
    
            for (let s=0; s<execInfo.outputSections.length; s++) {
                const si = execInfo.outputSections[s];
                const b = si.width > 0 ? res[i][si.name].slice(0, res[i][si.name].byteLength - si.width * next * ctx.Fr.n8) : res[i][si.name];
                ctx[si.name].set(b, i * nPerThread * si.width * ctx.Fr.n8);
            }
    
            if (useThreads) {
                promises.push(pool.exec("fflonkgen_execute", [ctxIn, false, cEveryRow, curN, execInfo, execPart, first, last, debug]));
            } else {
                res.push(await fflonkgen_execute(ctxIn, false, cEveryRow, curN, execInfo, execPart, first, last, debug));
            }
        }
        if (useThreads) {
            res = await Promise.all(promises)
        }
        for (let i = 0; i < res.length; i++) {
            for (let s = 0; s < execInfo.outputSections.length; s++) {
                const si = execInfo.outputSections[s];
                const b = si.width > 0 ? res[i][si.name].slice(0, res[i][si.name].byteLength * ctx.F.n8) : res[i][si.name];
                ctx[si.name].set(b, i * nPerThread * si.width * ctx.F.n8);
            }
        }
    }

    await pool.terminate();
}

module.exports.printPol = function printPol(buffer, Fr) {
    const len = buffer.byteLength / Fr.n8;

    console.log("---------------------------");
    for (let i = 0; i < len; ++i) {
        console.log(i, Fr.toString(buffer.slice(i * Fr.n8, (i + 1) * Fr.n8)));
    }
    console.log("---------------------------");
}

function ctxProxy(ctx) {
    const pCtx = {};
    
    const stark = ctx.prover === "stark" ? true : false;

    createProxy("const_n", stark);
    createProxy("const_ext", stark);
    createProxy("const_coefs", stark);
    for(let i = 0; i < ctx.pilInfo.numChallenges.length; i++) {
        createProxy(`cm${i + 1}_n`, stark);
        createProxy(`cm${i + 1}_ext`, stark);
        if(!stark) createProxy(`cm${i + 1}_coefs`, stark);
    }

    createProxy("tmpExp_n", stark);
    createProxy("x_n", stark);
    createProxy("x_ext", stark);
    createProxy("q_ext", stark);

    if(stark) {
        createProxy(`cm${ctx.pilInfo.numChallenges.length + 1}_ext`, stark);

        createProxy("Zi_ext", stark);

        createProxy("xDivXSubXi_ext", stark);

        createProxy("f_ext", stark);
    }

    pCtx.N = ctx.N;
    pCtx.nBits = ctx.nBits;

    pCtx.extN = ctx.extN;
    pCtx.nBitsExt = ctx.nBitsExt;

    pCtx.tmp = ctx.tmp;

    pCtx.pilInfo = ctx.pilInfo;

    pCtx.F = ctx.F;

    pCtx.publics = ctx.publics;
    pCtx.challenges = ctx.challenges;
    pCtx.challengesFRISteps = ctx.challengesFRISteps;
    pCtx.subAirValues = ctx.subAirValues;
    pCtx.evals = ctx.evals;

    pCtx.errors = ctx.errors;

    return pCtx;

    function createProxy(section, stark) {
        if (ctx[section]) {
            if(stark) {
                pCtx[section] = new Proxy(ctx[section], BigBufferHandlerBigInt);
            } else {
                pCtx[section] = new Proxy(ctx[section], BigBufferHandler);
            }
        }
    }
}

const BigBufferHandler = {
    get: function (obj, prop) {
        if (!isNaN(prop)) {
            return obj.slice(prop*32, prop*32 + 32);
        } else return obj[prop];
    },
    set: function (obj, prop, value) {
        if (!isNaN(prop)) {
            obj.set(value, prop*32);
            return true;
        } else {
            obj[prop] = value;
            return true;
        }
    },
};

const BigBufferHandlerBigInt = {
    get: function(obj, prop) {
        if (!isNaN(prop)) {
            return obj.getElement(prop);
        } else return obj[prop];
    },
    set: function(obj, prop, value) {
        if (!isNaN(prop)) {
            return obj.setElement(prop, value);
        } else {
            obj[prop] = value;
            return true;
        }
    }
};
