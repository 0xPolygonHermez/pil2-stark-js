const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require("fs");
const { challenges2zkinVadcop } = require('../src/proof2zkin');
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_updatezkin.js -z <mycircuit.proof.zkin.json> -v <verification_key.json>")
    .alias("v", "verkey")
    .alias("g", "globalchallenges")
    .alias("z", "zkin")
    .argv;

async function run() {

    const verKeyFile = typeof(argv.verkey) === "string" ?  argv.verkey.trim() : "mycircuit.verkey.json";
    const zkinFile = typeof(argv.zkin) === "string" ?  argv.zkin.trim() : "mycircuit.proof.zkin.json";

    const globalChallengesFile = typeof(argv.globalchallenges) === "string" ?  argv.globalchallenges.trim() : "mycircuit.globalchallenges.json";
    const globalChallenges = JSONbig.parse(await fs.promises.readFile(globalChallengesFile, "utf8"));

    const verKey = JSONbig.parse(await fs.promises.readFile(verKeyFile, "utf8"));
    const constRoot = verKey.constRoot;

    const zkin = JSONbig.parse(await fs.promises.readFile(zkinFile, "utf8"));
    zkin.rootCRecursive2 = constRoot;
    zkin.subAirValue = [0,0,0];

    challenges2zkinVadcop(globalChallenges, zkin);
    
    await fs.promises.writeFile(zkinFile, JSONbig.stringify(zkin, (k, v) => {
        if (typeof(v) === "bigint") {
            return v.toString();
        } else {
            return v;
        }
    }, 1), "utf8");

    console.log("file Generated Correctly");

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
