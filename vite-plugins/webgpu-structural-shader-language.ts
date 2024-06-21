import { Plugin } from "vite";

const fileRegex = /\.wgssl$/;
const keywords = ["Input", "Resources", "Global", "Entry"];
const stages = ["vertex", "fragment", "compute"];
const _return = "return";

export default function WGSSLPlugin(): Plugin {
  return {
    name: "wgssl-parser",
    enforce: "pre",
    transform(src, id) {
      if (fileRegex.test(id)) {
        const lines = src.split("\n");
        let info = "";
        const result = {
          Info: {
            Stage: "",
            Return: "",
            Addon: [] as string[],
          },
        };
        let keyword: string | undefined;
        const clear = (section: string) => {
          let res = result[section].trim() as string;
          res = res.replace(new RegExp(`${section}\\s*\{`), "");
          result[section] = res.replace(/}\s*$/, "").trim().trim();
        };

        lines.forEach((line, idx) => {
          const trimmedLine = line.trim();
          const findKeyWord = keywords.find((k) => trimmedLine.startsWith(k));
          // TODO： 需要清除注释
          if (findKeyWord) {
            keyword && clear(keyword);
            result[findKeyWord] = line;
            keyword = findKeyWord;
          } else if (keyword) {
            if (line.startsWith("@")) {
              info += line.trim();
            } else {
              result[keyword] += line.trim();
            }
          }
          idx == lines.length - 1 && keyword && clear(keyword);
        });

        info.split("@").forEach((i) => {
          const ti = i.trim();
          if (stages.includes(ti)) result.Info.Stage = ti;
          else if (ti.includes(_return))
            result.Info.Return = ti.split(/\s+/)[1];
          else if (ti) result.Info.Addon.push(`@${ti}`);
        });

        return `export default ${JSON.stringify(result)}`;
      }
      return src;
    },
  };
}
