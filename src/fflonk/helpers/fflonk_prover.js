const proofGen = require("../../prover/prover.js")

const parallelExec = false;
const useThreads = false;

module.exports = async function fflonkProve(zkey, cmPols, pilInfo, expressionsInfo, inputs = {}, options = {}) {
    if(!"parallelExec" in options) options.parallelExec = parallelExec;
    if(!"useThreads" in options) options.useThreads = useThreads;

    return proofGen(cmPols, pilInfo, expressionsInfo, inputs, null, null, zkey, options);
}