const fs = require("fs");
const version = require("../package").version;

const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");
const proofGen = require("./prover/prover.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true, storeAsString: true });
const { proof2zkin } = require("./proof2zkin");
const buildMerkleHashGL = require("./helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("./helpers/hash/merklehash/merklehash_bn128_p.js");

const Logger = require('logplease');

const F3g = require("./helpers/f3g.js");
const { createHash } = require("crypto");



const argv = require("yargs")
    .version(version)
    .usage("node main_prover.js -m commit.bin -c <const.bin> -t <consttree.bin> -p <pil.json> [-P <pilconfig.json>] -s <starkinfo.json> -o <proof.json> -b <public.json> -v <challenges.json> [--vadcop]")
    .alias("m", "commit")
    .alias("c", "const")
    .alias("t", "consttree")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("s", "starkinfo")
    .alias("i", "input")
    .alias("o", "proof")
    .alias("z", "zkin")
    .alias("b", "public")
    .alias("v", "vadcopchallenges")
    .string("proverAddr")
    .string("arity")
    .argv;

async function run() {
    const F = new F3g();

    const commitFile = typeof(argv.commit) === "string" ?  argv.commit.trim() : "mycircuit.commit";
    const constFile = typeof(argv.const) === "string" ?  argv.const.trim() : "mycircuit.const";
    const constTreeFile = typeof(argv.consttree) === "string" ?  argv.consttree.trim() : "mycircuit.consttree";
    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const pilConfig = typeof(argv.pilconfig) === "string" ? JSON.parse(fs.readFileSync(argv.pilconfig.trim())) : {};
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const inputFile = typeof(argv.input) === "string" ? argv.input.trim() : "mycircuit.input.json";
    const proofFile = typeof(argv.proof) === "string" ?  argv.proof.trim() : "mycircuit.proof.json";
    const zkinFile = typeof(argv.zkin) === "string" ?  argv.zkin.trim() : "mycircuit.proof.zkin.json";
    const publicFile = typeof(argv.public) === "string" ?  argv.public.trim() : "mycircuit.public.json";
    const challengesFile = typeof(argv.vadcopchallenges) === "string" ?  argv.vadcopchallenges.trim() : "mycircuit.challenges.json";

    const pil = await compile(F, pilFile, null, pilConfig);
    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));

    const inputs = typeof(argv.input) === "string" ? JSONbig.parse(await fs.promises.readFile(inputFile, "utf8")) : {};
    
    const constPols =  newConstantPolsArray(pil, F);
    await constPols.loadFromFile(constFile);

    const cmPols =  newCommitPolsArray(pil, F);
    await cmPols.loadFromFile(commitFile);

    const logger = Logger.create("pil-stark", {showTimestamp: false});
    Logger.setLogLevel("DEBUG");

    let vadcop = argv.vadcop || false;
    let hashCommits = argv.hashcommits || false;
    
    let options = {logger, vadcop, hashCommits};
    
    let MH;
    if (starkInfo.starkStruct.verificationHashType == "GL") {
        MH = await buildMerkleHashGL();
    } else if (starkInfo.starkStruct.verificationHashType == "BN128") {
        let arity = Number(argv.arity) || 16;
        let custom = argv.custom || false;

        options.arity = arity;
        options.custom = custom;

        console.log(`Arity: ${arity}, Custom: ${custom}, hashCommits: ${hashCommits}, vadcop: ${vadcop}`);
        MH = await buildMerkleHashBN128(arity, custom);
    } else {
        throw new Error("Invalid Hash Type: "+ starkInfo.starkStruct.verificationHashType);
    }

    const constTree = await MH.readFromFile(constTreeFile);

    const resP = await proofGen(cmPols, starkInfo, inputs, constTree, constPols, null, options)

    await fs.promises.writeFile(proofFile, JSONbig.stringify(resP.proof, null, 1), "utf8");

    const zkIn = proof2zkin(resP.proof, starkInfo);
    zkIn.publics = resP.publics;

    if(vadcop) {
        zkIn.challenges = resP.challenges;
        zkIn.challengesFRISteps = resP.challengesFRISteps;

        await fs.promises.writeFile(challengesFile, JSONbig.stringify({challenges: resP.challenges, challengesFRISteps: resP.challengesFRISteps}, null, 1), "utf8");
    }

    await fs.promises.writeFile(publicFile, JSONbig.stringify(resP.publics, null, 1), "utf8");
    if (starkInfo.starkStruct.verificationHashType == "BN128") {

        if (!argv.proverAddr) throw new Error("Prover Address not specified");
        zkIn.proverAddr = BigInt(argv.proverAddr);


        let b= zkIn.proverAddr.toString(16);
        while (b.length < 40) b = "0" + b;

        for (let i=0; i<resP.publics.length; i++) {
            let b2 = resP.publics[i].toString(16);
            while (b2.length<16) b2 = "0" + b2;
            b = b + b2;
        }

        const publicsHash = BigInt("0x" + createHash('sha256').update(b, 'hex').digest("hex")) % 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

        console.log(`Publics Hash: 0x${publicsHash.toString()}`);
    }


    await fs.promises.writeFile(zkinFile, JSONbig.stringify(zkIn, (k, v) => {
        if (typeof(v) === "bigint") {
            return v.toString();
        } else {
            return v;
        }
    }, 1), "utf8");

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
