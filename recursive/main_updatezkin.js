const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_updatezkin.js -z <mycircuit.proof.zkin.json> -v <verification_key.json>")
    .alias("v", "verkey")
    .alias("z", "zkin")
    .argv;

async function run() {

    const verKeyFile = typeof(argv.verkey) === "string" ?  argv.verkey.trim() : "mycircuit.verkey.json";
    const zkinFile = typeof(argv.zkin) === "string" ?  argv.zkin.trim() : "mycircuit.proof.zkin.json";
   
    const verKey = JSONbig.parse(await fs.promises.readFile(verKeyFile, "utf8"));
    const constRoot = verKey.constRoot;

    const zkin = JSONbig.parse(await fs.promises.readFile(zkinFile, "utf8"));
    zkin.rootCRecursive2 = constRoot;
    zkin.subAirValue = [0,0,0];

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
