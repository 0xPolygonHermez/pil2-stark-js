const proofGen  = require("../prover/prover.js")

const parallelExec = true;
const useThreads = true;

module.exports = async function starkGen(cmPols, constPols, constTree, pilInfo, options = {}) {
    if(!"parallelExec" in options) options.parallelExec = parallelExec;
    if(!"useThreads" in options) options.useThreads = useThreads;

    return proofGen(cmPols, pilInfo, constTree, constPols, null, options);
}
