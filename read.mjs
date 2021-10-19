import { exec } from "child_process";
import fs from "fs";
import _ from "lodash";
import { promisify } from "util";

const content = await fs.promises.readFile("550", "utf8");
const a = content
  .split(/\r?\n/g)
  .filter((e) => e.trim())
  //   .slice(0, 100)
  .map((line) => {
    const [meta, ...params] = line.split(/\t/);
    const [t1, t2] = meta.split(/\s+/);
    // console.log(t1, t2);
    const 时间 = new Date(+Number(t1) * 1000);
    const 类型 = Number(t2);
    // console.log();
    // switch (类型) {
    //   case 7:
    //     //   -1 -1
    //     console.log(a, b);
    //     break;
    //   case 9:
    //     console.log(a, b, c, d, e, f, g);
    //     break;
    //   default:
    //     console.error(a, b, c, d, e, f, g);
    //     throw new Error("未知类型：" + line);
    // }
    return [时间, 类型, ...params];
  });
const 组 = _.groupBy(a, (e) => e[1]);
const 组值 = _.values(组);
const 提首 = _.map(组值, (列) => [列.length, ...列[0]]);
const 出列 = _.sortBy(提首, (e) => e[2] /* 类型 */);
const f = "550-sample.csv";
console.log(await promisify(exec)("kill excel || echo no excel"));
await fs.promises.writeFile(
  f,
  "\uFEFF" + 出列.map((e) => e.join(",")).join("\n")
);
await promisify(exec)(f);
console.table(a);
