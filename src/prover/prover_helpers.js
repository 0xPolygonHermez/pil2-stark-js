const { proofgen_execute } = require("./prover_worker");
const workerpool = require("workerpool");
const {BigBuffer} = require("ffjavascript");
const { calculateZ, calculateH1H2 } = require("../helpers/polutils");

const maxNperThread = 1<<18;
const minNperThread = 1<<12;

module.exports.calculatePublics = async function calculatePublics(ctx) {
    // Calculate publics
    ctx.publics = [];
    for (let i=0; i<ctx.pilInfo.nPublics; i++) {
        ctx.publics[i] = module.exports.calculateExpAtPoint(
            ctx, 
            ctx.pilInfo.publicsCode[i], 
            ctx.pilInfo.publicsCode[i].idx
        );
    }
}

module.exports.callCalculateExps = async function callCalculateExps(step, dom, ctx, parallelExec, useThreads) {
    if (parallelExec) {
        await module.exports.calculateExpsParallel(ctx, step, useThreads);
    } else {
        module.exports.calculateExps(ctx, ctx.pilInfo.code[step], dom);
    }
}

module.exports.calculateExps = function calculateExps(ctx, code, dom) {
    ctx.tmp = new Array(code.tmpUsed);

    cEveryRow = new Function("ctx", "i", module.exports.compileCode(ctx, code.code, dom));

    const N = dom=="n" ? ctx.N : ctx.extN;

    for (let i=0; i<N; i++) {
        cEveryRow(ctx, i);
    }
}

module.exports.calculateExpAtPoint = function calculateExpAtPoint(ctx, code, i) {
    ctx.tmp = new Array(code.tmpUsed);
    cEveryRow = new Function("ctx", "i", module.exports.compileCode(ctx, code.code, "n", true));

    return cEveryRow(ctx, i);
}


module.exports.compileCode = function compileCode(ctx, code, dom, ret) {
    const body = [];

    for (let j=0;j<code.length; j++) {
        const src = [];
        for (k=0; k<code[j].src.length; k++) {
            src.push(getRef(code[j].src[k]));
        }
        let exp;
        switch (code[j].op) {
            case 'add': exp = `ctx.F.add(${src[0]}, ${src[1]})`; break;
            case 'sub': exp = `ctx.F.sub(${src[0]}, ${src[1]})`; break;
            case 'mul': exp = `ctx.F.mul(${src[0]}, ${src[1]})`; break;
            case 'copy': exp = `${src[0]}`; break;
            default: throw new Error("Invalid op:"+ code[j].op);
        }
        setRef(code[j].dest, exp);
    }

    if (ret) {
        body.push(`  return ${getRef(code[code.length-1].dest)};`);
    }

    return body.join("\n");

    function getRef(r) {
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
                    return evalMap(r.id, r.prime, dom)
                } else if (dom=="ext") {
                    return evalMap(r.id, r.prime, dom)
                } else {
                    throw new Error("Invalid dom");
                }
            }
            case "number": return `ctx.F.e(${r.value}n)`;
            case "public": return `ctx.publics[${r.id}]`;
            case "challenge": return `ctx.challenges[${r.id}]`;
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
                if(r.boundary === "everyRow") {
                    return `ctx.Zi_ext[i]`;
                } else if(r.boundary === "firstRow") {
                    return `ctx.Zi_fr_ext[i]`;
                } else if(r.boundary === "lastRow") {
                    return `ctx.Zi_lr_ext[i]`;
                } else if(r.boundary === "everyFrame") {
                    return `ctx.Zi_frame${r.frameId}_ext[i]`;
                } else {
                    throw new Error("Invalid boundary: " + r.boundary);
                }
            }
            default: throw new Error("Invalid reference type get: " + r.type);
        }
    }

    function setRef(r, val) {
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
                    body.push(` ${evalMap( r.id, r.prime, dom, val)};`);
                } else if (dom=="ext") {
                    body.push(` ${evalMap( r.id, r.prime, dom, val)};`);
                } else {
                    throw new Error("Invalid dom");
                }
                break;
            default: throw new Error("Invalid reference type set: " + r.type);
        }
    }

    function evalMap(polId, prime, dom, val) {
        let p = ctx.pilInfo.cmPolsMap[polId];
        offset = ctx.pilInfo.cmPolsMap
            .filter((pol, index) => pol.stage === p.stage && index < polId)
            .reduce((acc, pol) => acc + pol.dim, 0);
        const N = dom === "n" ? ctx.N : ctx.extN;
        let next;
        if(dom === "n") {
            next = prime < 0 ? prime + N : prime;
        } else {
            next = prime < 0 ? (prime + N) << ctx.extendBits : prime << ctx.extendBits;
        }
        let index = prime ? `((i + ${next})%${N})` : "i";
        let size = ctx.pilInfo.mapSectionsN[p.stage];
        let stage = dom === "n" ? p.stage + "_n" : p.stage + "_ext";
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
}

function setPol(ctx, idPol, pol, dom) {
    const p = module.exports.getPolRef(ctx, idPol, dom);

    if (p.dim == 1) {
        let buildPol = new Function("ctx", "i", "pol", [`ctx.${p.stage}[${p.offset} + i * ${p.size}] = pol;`]);
        for (let i=0; i<p.deg; i++) {
            buildPol(ctx, i, pol[i]);
        }
    } else if (p.dim == 3) {
        const buildPolCode = [];
        buildPolCode.push(`ctx.${p.stage}[${p.offset} + i * ${p.size}] = pol[0];`);
        buildPolCode.push(`ctx.${p.stage}[${p.offset} + i * ${p.size} + 1] = pol[1];`);
        buildPolCode.push(`ctx.${p.stage}[${p.offset} + i * ${p.size} + 2] = pol[2];`);
    
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
    let offset = ctx.pilInfo.cmPolsMap
    .filter((pol, index) => pol.stage === p.stage && index < idPol)
    .reduce((acc, pol) => acc + pol.dim, 0);
    let polRef = {
        stage,
        buffer: ctx[stage],
        deg,
        offset,
        size: ctx.pilInfo.mapSectionsN[p.stage],
        dim: p.dim
    };
    return polRef;
}

function getPol(ctx, idPol, dom) {
    const p = module.exports.getPolRef(ctx, idPol, dom);
    const res = new Array(p.deg);
    if (p.dim == 1) {
        let buildPol = new Function("ctx", "i", "res", [`res[i] = ctx.${p.stage}[${p.offset} + i * ${p.size}];`]);
        for (let i=0; i<p.deg; i++) {
            buildPol(ctx, i, res);
        }
    } else if (p.dim == 3) {
        const buildPolCode = [];
        buildPolCode.push(`res[i] = [ctx.${p.stage}[${p.offset} + i * ${p.size}], ctx.${p.stage}[${p.offset} + i * ${p.size} + 1],ctx.${p.stage}[${p.offset} + i * ${p.size} + 2]];`);
    
        let buildPol = new Function("ctx", "i", "res", buildPolCode.join("\n"));

        for (let i=0; i<p.deg; i++) {
            buildPol(ctx, i, res);
        }
    } else {
        throw new Error("invalid dim" + p.dim)
    }
    return res;
}


module.exports.calculateExpsParallel = async function calculateExpsParallel(ctx, execPart, useThreads) {

    const pool = workerpool.pool(__dirname + '/prover_worker.js');

    let dom;
    let code = ctx.pilInfo.code[execPart];
    let execInfo = {
        inputSections: [],
        outputSections: []
    };

    const execStages = [];
    for(let i = 0; i < ctx.pilInfo.numChallenges.length; ++i) {
        const stage = 1 + i;
        execStages.push(`stage${stage}`);
    }

    const qStage = ctx.pilInfo.numChallenges.length + 1;

    const ziPols = ["Zi_ext"];
    if(ctx.pilInfo.boundaries.includes("firstRow")) ziPols.push("Zi_fr_ext");
    if(ctx.pilInfo.boundaries.includes("lastRow")) ziPols.push("Zi_lr_ext");
    if(ctx.pilInfo.boundaries.includes("everyRow")) {
        for(let i = 0; i < ctx.pilInfo.constraintFrames.length; ++i) ziPols.push(`Zi_frame${i}_ext`);
    }
    
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
    } else if (execPart === `stage${qStage}`) {
        execInfo.inputSections.push({ name: "const_ext" });
        for(let i = 0; i < ctx.pilInfo.numChallenges.length; i++) {
            const stage = i + 1;
            execInfo.inputSections.push({ name: `cm${stage}_ext` });
        }
        execInfo.inputSections.push({ name: "x_ext" });
        execInfo.outputSections.push({ name: "q_ext" });
        if(ctx.prover === "stark") {
            for(let i = 0; i < ziPols.length; ++i) {
                execInfo.inputSections.push({ name: ziPols[i] });
            }
        }
        dom = "ext";
    } else if (execPart == "fri") {
        execInfo.inputSections.push({ name: "const_ext" });
        for(let i = 0; i < ctx.pilInfo.numChallenges.length; i++) {
            const stage = i + 1;
            execInfo.inputSections.push({ name: `cm${stage}_ext` });
        }
        execInfo.inputSections.push({ name: "cmQ_ext" });
        execInfo.inputSections.push({ name: "xDivXSubXi_ext" });
        execInfo.outputSections.push({ name: "f_ext" });
        dom = "ext";
    } else {
        throw new Error("Exec type not defined " + execPart);
    }

    function setWidth(stage) {
        if ((stage.name == "const_n") || (stage.name == "const_ext")) {
            stage.width = ctx.pilInfo.nConstants;
        } else if (typeof ctx.pilInfo.mapSectionsN[stage.name.split("_")[0]] != "undefined") {
            stage.width = ctx.pilInfo.mapSectionsN[stage.name.split("_")[0]];
        } else if (["x_n", "x_ext", ...ziPols].indexOf(stage.name) >= 0) {
            stage.width = 1;
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

    const cEveryRow = module.exports.compileCode(ctx, code.code, dom, false);

    const N = dom === "n" ? ctx.N : ctx.extN;

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
                challenges: ctx.challenges
            };
            for (let s = 0; s < execInfo.inputSections.length; s++) {
                const si = execInfo.inputSections[s];
                ctxIn[si.name] = new BigUint64Array(curN * si.width);
                const s1 = ctx[si.name].slice(i * si.width, (i + curN) * si.width);
                ctxIn[si.name].set(s1);
            }
    
            for (let s=0; s<execInfo.outputSections.length; s++) {
                const si = execInfo.outputSections[s];
                if (typeof ctxIn[si.name] == "undefined") {
                    ctxIn[si.name] = new BigUint64Array(curN * si.width);
                }
            }
    
            if (useThreads) {
                promises.push(pool.exec("proofgen_execute", [ctxIn, true, cEveryRow, curN, execInfo, execPart, i, N]));
            } else {
                res.push(await proofgen_execute(ctxIn, true, cEveryRow, curN, execInfo, execPart, i, N));
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
            for (let s = 0; s < execInfo.inputSections.length; s++) {
                const si = execInfo.inputSections[s];
                ctxIn[si.name] = new BigBuffer(curN * si.width * ctx.F.n8);
                const s1 = si.width > 0 ? ctx[si.name].slice(i * si.width * ctx.F.n8, (i + curN) * si.width * ctx.F.n8) : ctx[si.name];
                ctxIn[si.name].set(s1, 0);
                ctxIn[si.name] = new Proxy(ctxIn[si.name], BigBufferHandler);
            }
    
            for (let s=0; s<execInfo.outputSections.length; s++) {
                const si = execInfo.outputSections[s];
                if (typeof ctxIn[si.name] == "undefined") {
                    ctxIn[si.name] = new BigBuffer(curN * si.width * ctx.F.n8);
                }
                ctxIn[si.name] = new Proxy(ctxIn[si.name], BigBufferHandler);
            }
    
            if (useThreads) {
                promises.push(pool.exec("proofgen_execute", [ctxIn, false, cEveryRow, curN, execInfo, execPart, i, N]));
            } else {
                res.push(await proofgen_execute(ctxIn, false, cEveryRow, curN, execInfo, execPart, i, N));
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

async function hintFunctions(functionName, F, inputs) {
    if(functionName === "calculateZ") {
        return calculateZ(F, ...inputs);
    } else if(functionName === "calculateH1H2") {
        return calculateH1H2(F,...inputs);
    } else {
        throw new Error("Invalid function name: " + functionName);
    }
}

module.exports.applyHints = async function applyHints(stage, ctx) {
    for(let i = 0; i < ctx.pilInfo.hints.length; i++) {
        const hint = ctx.pilInfo.hints[i];
        if(hint.stage !== stage) continue;

        const inputs = [];
        for(let j = 0; j < hint.inputs.length; ++j) {
            const inputIdx = ctx.pilInfo.cmPolsMap.findIndex(c => c.name === hint.inputs[j]);
            const pol = getPol(ctx, inputIdx, "n")
            inputs.push(pol);
        } 
        const outputs = await hintFunctions(hint.lib,ctx.F, inputs);
        for(let j = 0; j < hint.outputs.length; ++j) {
            const outputIdx = ctx.pilInfo.cmPolsMap.findIndex(c => c.name === hint.outputs[j]);
            setPol(ctx, outputIdx, outputs[j], "n");
        }    
    }
}


module.exports.printPol = function printPol(buffer, Fr) {
    const len = buffer.byteLength / Fr.n8;

    console.log("---------------------------");
    for (let i = 0; i < len; ++i) {
        console.log(i, Fr.toString(buffer.slice(i * Fr.n8, (i + 1) * Fr.n8)));
    }
    console.log("---------------------------");
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

module.exports.BigBufferHandler = BigBufferHandler;
module.exports.BigBufferHandlerBigInt = BigBufferHandlerBigInt;
