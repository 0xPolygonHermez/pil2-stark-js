
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

    exp(id, rowOffset = 0, stage) {
        return {
            op: "exp",
            id: id,
            rowOffset: rowOffset,
            stage: stage,
        }
    }

    cm(id, rowOffset = 0, stage, dim = 1) {
        if(!(id in cmStages)) {
            if(stage) {
                cmStages[id] = stage;
            } else {
                throw new Error("Stage not defined for cm " + id);
            }
        } 
        return {
            op: "cm",
            id,
            stage: cmStages[id],
            dim,
            rowOffset
        }
    }

    const(id, rowOffset = 0, dim = 1) {
        return {
            op: "const",
            id,
            rowOffset,
            dim
        }
    }

 
    challenge(name, stage, dim) {
        if (!name) throw new Error("Challenge name not defined");
        if (!(name in challenges)) {
            challenges[name] = {
                id: nChallenges++,
                stage,
                dim,
            }
        }
        return {
            op: "challenge",
            id: challenges[name].id,
            stage: challenges[name].stage,
            dim: challenges[name].dim,
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

    eval(id, dim) {
        return {
            op: "eval",
            id,
            dim,
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
