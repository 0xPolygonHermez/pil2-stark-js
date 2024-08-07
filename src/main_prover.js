const fs = require("fs");
const path = require("path");
const version = require("../package").version;

const protobuf = require('protobufjs');

const { compile } = require("pilcom");
const compilePil2 = require("pil2-compiler/src/compiler.js");

const proofGen = require("./prover/prover.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const { proof2zkin } = require("./proof2zkin");
const buildMerkleHashGL = require("./helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("./helpers/hash/merklehash/merklehash_bn128_p.js");

const Logger = require('logplease');

const F3g = require("./helpers/f3g.js");
const { createHash } = require("crypto");
const { generateWtnsCols, generateFixedCols } = require("./witness/witnessCalculator.js");



const argv = require("yargs")
    .version(version)
    .usage("node main_prover.js -m commit.bin -c <const.bin> -t <consttree.bin> -p <pil.json> [-P <pilconfig.json>] -s <starkinfo.json> -e <expressionsinfo.json> -o <proof.json> -b <public.json> -v <challenges.json>")
    .alias("m", "commit")
    .alias("c", "const")
    .alias("t", "consttree")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("s", "starkinfo")
    .alias("e", "expressionsinfo")
    .alias("i", "input")
    .alias("o", "proof")
    .alias("z", "zkin")
    .alias("b", "public")
    .alias("v", "vadcopchallenges")
    .string("proverAddr")
    .argv;

async function run() {
    const F = new F3g();

    const commitFile = typeof(argv.commit) === "string" ?  argv.commit.trim() : "mycircuit.commit";
    const constFile = typeof(argv.const) === "string" ?  argv.const.trim() : "mycircuit.const";
    const constTreeFile = typeof(argv.consttree) === "string" ?  argv.consttree.trim() : "mycircuit.consttree";
    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const expressionsInfoFile = typeof(argv.expressionsinfo) === "string" ?  argv.expressionsinfo.trim() : "mycircuit.expressionsinfo.json";
    const inputFile = typeof(argv.input) === "string" ? argv.input.trim() : "mycircuit.input.json";
    const proofFile = typeof(argv.proof) === "string" ?  argv.proof.trim() : "mycircuit.proof.json";
    const zkinFile = typeof(argv.zkin) === "string" ?  argv.zkin.trim() : "mycircuit.proof.zkin.json";
    const publicFile = typeof(argv.public) === "string" ?  argv.public.trim() : "mycircuit.public.json";

    const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
    const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));
    const inputs = JSONbig.parse(await fs.promises.readFile(inputFile, "utf8"));

    let cmPols;
    let constPols;

    if(starkInfo.pil2) {
        const tmpPath = path.resolve(__dirname, '../tmp');
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        const piloutPath = path.join(tmpPath, "pilout.ptb");
        let pilConfig = { outputFile: piloutPath};
        compilePil2(F, pilFile, null, pilConfig);
        
        const piloutEncoded = fs.readFileSync(piloutPath);
        const pilOutProtoPath = path.resolve(__dirname, '../node_modules/pil2-compiler/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;
        pil.airId = 0;
        pil.subproofId = 0;

        constPols = generateFixedCols(pil.symbols, pil.numRows);
        cmPols = generateWtnsCols(pil.symbols, pil.numRows);
    } else {
        const pil = await compile(F, pilFile, null);

        const N = Object.values(pil.references)[0].polDeg;
        constPols = generateFixedCols(pil.references, N, false);
        cmPols = generateWtnsCols(pil.references, N, false);
    }
   
    await constPols.loadFromFile(constFile);
    await cmPols.loadFromFile(commitFile);

    const logger = Logger.create("pil-stark", {showTimestamp: false});
    Logger.setLogLevel("DEBUG");

    
    let options = {
        logger, 
    };
    
    let MH;
    if (starkInfo.starkStruct.verificationHashType == "GL") {
        MH = await buildMerkleHashGL();
    } else if (starkInfo.starkStruct.verificationHashType == "BN128") {
        console.log(`Arity: ${starkInfo.starkStruct.merkleTreeArity}, Custom: ${starkInfo.starkStruct.merkleTreeCustom}`);
        MH = await buildMerkleHashBN128(starkInfo.starkStruct.merkleTreeArity, starkInfo.starkStruct.merkleTreeCustom);
    } else {
        throw new Error("Invalid Hash Type: "+ starkInfo.starkStruct.verificationHashType);
    }

    const constTree = await MH.readFromFile(constTreeFile);

    const resP = await proofGen(cmPols, starkInfo, expressionsInfo, inputs, constTree, constPols, null, options)

    await fs.promises.writeFile(proofFile, JSONbig.stringify(resP.proof, null, 1), "utf8");

    const zkIn = proof2zkin(resP.proof, starkInfo);
    zkIn.publics = resP.publics;

    if(argv.vadcopchallenges) {
        const challengesFile = typeof(argv.vadcopchallenges) === "string" ?  argv.vadcopchallenges.trim() : "mycircuit.challenges.json";
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
