
let challenges = {};
let nChallenges = 0;

let cmStages = {};
class ExpressionOps {

    add(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            op: "add",
            values: [ a, b]
        }
    }

    sub(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            op: "sub",
            values: [ a, b]
        }
    }

    mul(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            op: "mul",
            values: [ a, b]
        }
    }

    neg(a) {
        return {
            op: "neg",
            values: [a]
        }
    }

    exp(id, rowOffset = 0) {
        return {
            op: "exp",
            id: id,
            rowOffset: rowOffset
        }
    }

    cm(id, rowOffset = 0, stage) {
        if(!(id in cmStages)) {
            if(stage) {
                cmStages[id] = stage;
            } else {
                console.log("CM STAGES", cmStages);
                throw new Error("Stage not defined for cm " + id);
            }
        } 
        return {
            op: "cm",
            id: id,
            stage: cmStages[id],
            rowOffset: rowOffset
        }
    }

    const(id, rowOffset = 0) {
        return {
            op: "const",
            id: id,
            rowOffset: rowOffset
        }
    }

 
    challenge(name, stage) {
        if (!name) throw new Error("Challenge name not defined");
        if (!(name in challenges)) {
            challenges[name] = {
                id: nChallenges++,
                stage: stage
            }
        }
        return {
            op: "challenge",
            id: challenges[name].id,
            stage: challenges[name].stage
        };
    }

    getChallenges() {
        return challenges;
    }

    number(n) {
        return {
            op: "number",
            value: BigInt(n)
        }
    }

    eval(n) {
        return {
            op: "eval",
            id: n
        }
    }

    tmp(n) {
        return {
            op: "tmp",
            id: n
        }
    }

    xDivXSubXi(opening) {
        return {
            op: "xDivXSubXi",
            opening: opening
        }
    }

    zi(boundary, frameId) {
        return {
            op: "Zi",
            boundary,
            frameId,
        }
    }

    x() {
        return {
            op: "x"
        }
    }

}

module.exports = ExpressionOps;
