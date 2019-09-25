import "source-map-support/register";

const fs = require("fs-extra");
import * as ndjson from "ndjson";
const JSONStream = require("JSONStream");
import * as path from "path";
import { DOMParser } from "xmldom";
const select = require("xpath.js");
import { Base64 } from "js-base64";
const prettier = require("prettier");
const SVGO = require("svgo");
import {
  assign,
  camelCase,
  curry,
  defaultsDeep,
  isArray,
  isEmpty,
  isFinite,
  isString,
  keys,
  flow,
  fromPairs,
  partition,
  pick,
  toPairs,
  union,
  uniq,
  upperFirst
} from "lodash/fp";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Parser, Validator } from "collit";

// TODO why doesn't "import * as name" work with Webpack for the following packages?
const hl = require("highland");
const isVarName = require("is-valid-var-name");
const getit = require("getit");
const program = require("commander");
const urlRegex = require("url-regex");
const validDataUrl = require("valid-data-url");
const VError = require("verror");
const readPkgUp = require("read-pkg-up");

const resultFromReadPkgUp = readPkgUp.sync();

import { Diagram } from "../components/Diagram";
import { arrayify } from "../spinoffs/jsonld-utils";
import { processFilterDef } from "./processFilterDef";
import { processMarkerDef } from "./processMarkerDef";
import { processSymbolDef } from "./processSymbolDef";

// TODO which of these plugins are defaults and don't need to be specified here?
const svgo = new SVGO({
  //full: true,
  plugins: [
    {
      cleanupAttrs: true
    },
    {
      removeDoctype: true
    },
    {
      removeXMLProcInst: true
    },
    {
      removeComments: true
    },
    {
      removeMetadata: true
    },
    {
      removeTitle: true
    },
    {
      removeDesc: true
    },
    {
      removeUselessDefs: true
    },
    {
      removeEditorsNSData: true
    },
    {
      removeEmptyAttrs: true
    },
    {
      removeHiddenElems: true
    },
    {
      removeEmptyText: true
    },
    {
      removeEmptyContainers: true
    },
    {
      removeViewBox: false
    },
    {
      cleanUpEnableBackground: true
    },
    {
      convertStyleToAttrs: true
    },
    {
      convertColors: true
    },
    {
      convertPathData: true
    },
    {
      convertTransform: true
    },
    {
      removeUnknownsAndDefaults: true
    },
    {
      removeNonInheritableGroupAttrs: true
    },
    {
      removeUselessStrokeAndFill: true
    },
    {
      removeUnusedNS: true
    },
    {
      cleanupIDs: false
    },
    {
      cleanupNumericValues: true
    },
    {
      moveElemsAttrsToGroup: true
    },
    {
      moveGroupAttrsToElems: false
    },
    {
      collapseGroups: true
    },
    {
      removeRasterImages: false
    },
    {
      mergePaths: true
    },
    {
      convertShapeToPath: true
    },
    {
      sortAttrs: true
    },
    {
      transformsWithOnePath: true
    },
    {
      removeDimensions: true
    },
    {
      removeScriptElement: true
    },
    /*
    {
      removeXMLNS: true
    },
    //*/
    {
      removeAttrs: { attrs: "(data-context-stroke-dashoffset|xmlns)" }
    }
  ]
  //js2svg: { pretty: true, indent: 2 }
});

const npmPackage = require("../../package.json");
const exec = hl.wrapCallback(require("child_process").exec);

const ensureFile = hl.wrapCallback(fs.ensureFile);
const readFile = hl.wrapCallback(fs.readFile);

const NS = {
  svg: "http://www.w3.org/2000/svg"
};

const STRING_TO_BOOLEAN = {
  true: true,
  false: false
};

// TODO why does TS complain when I define and try using the titleCase below?
//const titleCase = flow(camelCase, upperFirst);
function getSuggestedVarName(str: string): string {
  const titleCasedName = upperFirst(camelCase(str));
  return !titleCasedName
    ? "SampleName"
    : titleCasedName.match(/[_a-zA-Z]\w*/)[0];
}

/* TODO get this working
const DEFAULT_FONTS = ["Arial", "Times New Roman"];
import { NodeTextSizer } from "./NodeTextSizer";
const nodeTextSizer = new NodeTextSizer(DEFAULT_FONTS);
//*/

function get(inputPath, opts = {}) {
  const strippedPath = inputPath.replace("file://", "");
  return hl.wrapCallback(getit)(strippedPath, opts);
}

function pipeToFilepath(inputStream, destPath) {
  return ensureFile(destPath)
    .flatMap(success => readFile(destPath))
    .collect()
    .flatMap(function(originalContentChunks) {
      const destStream = fs.createWriteStream(destPath);

      const observerStream = hl([
        hl("finish", destStream),
        hl("error", destStream)
      ]).merge();

      inputStream.pipe(destStream);

      return observerStream.errors(function(err, push) {
        const augmentedErr = new VError(
          err,
          `Error in pipeToFilepath(${inputStream}, ${destPath}).`
        );
        pipeToFilepath(hl(originalContentChunks), destPath)
          .errors(function(revertErr, revertPush) {
            push(
              VError.errorFromList(
                augmentedErr,
                new VError(revertErr, `Failed to revert to initial contents.`)
              )
            );
          })
          .last()
          .each(function() {
            push(new VError(augmentedErr, `Reverted to initial contents.`));
          });
      });
    });
}

function parseThemeSpecPropertyPair(
  themeSpecPath: string,
  [themeSpecPropertyKey, themeSpecPropertyValue]: [
    string,
    Record<string, string | Record<string, string | boolean>>
  ]
) {
  return toPairs(themeSpecPropertyValue).map(function([id, value]) {
    let src;
    let preserveAspectRatio;
    let destTagName;

    if (isString(value)) {
      src = value;
      preserveAspectRatio = false;
    } else {
      src = value.src;
      destTagName = value.tagName;
      preserveAspectRatio =
        "preserveAspectRatio" in value ? value.preserveAspectRatio : false;
    }

    let semiResolvedSrc;
    let defElementIdInSrc;
    if (src.indexOf("http") === 0 || validDataUrl(src)) {
      // not resolving urls yet
      // TODO should we resolve them here instead of later in the code?
      semiResolvedSrc = src;
    } else if (src === "kaavio") {
      //? path.relative(__dirname, path.dirname(resultFromReadPkgUp.path))
      /*
        ? `${path.relative(
            __dirname,
            path.dirname(resultFromReadPkgUp.path)
          )}/src`
	  //*/
      const kaavioBase =
        resultFromReadPkgUp.pkg.name === "kaavio"
          ? path.dirname(resultFromReadPkgUp.path)
          : "kaavio";
      console.log(`kaavioBase: ${kaavioBase}`);
      semiResolvedSrc = `${kaavioBase}/es5/drawers/${themeSpecPropertyKey}/index`;
      console.log(`Resolved kaavio as ${semiResolvedSrc}`);
    } else {
      const [pathRelativeToThemeSpecFile, afterHash] = src
        .replace("file://", "")
        .split("#");
      defElementIdInSrc = afterHash;
      semiResolvedSrc = path.resolve(
        path.dirname(themeSpecPath),
        pathRelativeToThemeSpecFile
      );
    }
    return {
      id,
      defElementIdInSrc,
      src: semiResolvedSrc,
      preserveAspectRatio,
      destTagName
    };
  });
}

/************************
 * Bundler content starts
 ************************/

function bundleBySelectiveExportFromKaavio({
  tagName,
  themeSpecParsedPropertyValue
}) {
  console.log(`Importing ${tagName}:`);
  return toPairs(
    themeSpecParsedPropertyValue.reduce(function(
      acc,
      { id: moduleName, src: modulePath }
    ) {
      if (!isVarName(moduleName)) {
        throw new Error(
          `Input item "${moduleName}" is not a valid name.
	Suggested Replacement: ${getSuggestedVarName(moduleName)}
	Must be a valid JS identifier <https://tc39.github.io/ecma262/#prod-Identifier>`
        );
      }

      if (!acc.hasOwnProperty(modulePath)) {
        acc[modulePath] = [];
      }
      acc[modulePath].push(moduleName);
      return acc;
    },
    {})
  )
    .map(function([modulePath, moduleNames]: [string, string[]]) {
      const exports =
        isEmpty(moduleNames) || moduleNames[0] === "*"
          ? "*"
          : "{" + uniq(moduleNames).join(", ") + "}";

      console.log(`  ${moduleNames.join(", ")}
	src: ${modulePath}`);

      return `export ${exports} from "${modulePath}";`;
    })
    .join("\n");
}

function getDefSVGContentAsParsedNode({
  id: defElementIdOut,
  defElementIdInSrc,
  preserveAspectRatio,
  src,
  destTagName
}) {
  console.log(`  ${defElementIdOut}
	src: ${src}
	preserveAspectRatio: ${preserveAspectRatio}`);
  // NOTE: data URI parsing is a variation of code from
  // https://github.com/killmenot/parse-data-url/blob/master/index.js
  let svgStringStream;
  if (validDataUrl(src)) {
    const parts = src.match(validDataUrl.regex);
    let mediaType;
    if (parts[1]) {
      mediaType = parts[1].toLowerCase();
    }

    let charset;
    if (parts[2]) {
      charset = parts[2].split("=")[1].toLowerCase();
    }

    const isBase64 = !!parts[3];

    let data;
    if (parts[4]) {
      data = parts[4];
    }

    const decoded = !isBase64 ? decodeURIComponent(data) : Base64.decode(data);
    svgStringStream = hl([decoded]);
  } else {
    if (urlRegex({ strict: true, exact: true }).test(src)) {
      svgStringStream = get(src);
    } else {
      svgStringStream = get(src);
    }
  }

  return svgStringStream.map(function(svgString) {
    const doc = new DOMParser().parseFromString(svgString);
    const node = !defElementIdInSrc
      ? doc.documentElement
      : doc.getElementById(defElementIdInSrc);
    const contentTagName = node.tagName;
    // NOTE: "defElementIdOut" may or may not equal "defElementIdInSrc", which is
    //       the id of this element as set in the source SVG.
    node.setAttribute("id", defElementIdOut);
    return {
      node,
      preserveAspectRatio,
      contentTagName,
      destTagName: destTagName || contentTagName
    };
  });
}

const processDefOfType = {
  clipPath: function({
    node,
    preserveAspectRatio,
    contentTagName,
    destTagName
  }) {
    return { node, jic: {} };
  },
  filter: processFilterDef,
  marker: processMarkerDef,
  pattern: function({
    node,
    preserveAspectRatio,
    contentTagName,
    destTagName
  }) {
    return { node, jic: {} };
  },
  symbol: processSymbolDef
};

const processThemeSpecPropertyFor = {
  defs: function({
    themeName,
    themeSpecPropertyName,
    themeSpecParsedPropertyValue
  }) {
    console.log("Processing defs...");
    return hl(themeSpecParsedPropertyValue)
      .flatMap(getDefSVGContentAsParsedNode)
      .flatMap(function({
        node,
        preserveAspectRatio,
        contentTagName,
        destTagName
      }) {
        return hl(
          arrayify(
            destTagName in processDefOfType
              ? processDefOfType[destTagName]({
                  node,
                  preserveAspectRatio,
                  contentTagName,
                  destTagName
                })
              : { node, jic: {} }
          )
        );
      })
      .reduce({ content: "", jic: {} }, function(acc, { node, jic }) {
        acc.content += node.toString();
        acc.jic = defaultsDeep(acc.jic, jic);
        return acc;
      })
      .flatMap(function(processed) {
        return hl(
          svgo.optimize(
            `<svg xmlns="http://www.w3.org/2000/svg"><defs>${processed.content}</defs></svg>`
          )
        ).map(function({ data, info }) {
          const jic = processed.jic;
          const JicKey = keys(jic)
            .map(key => `"${key}"`)
            .join("|");
          return prettier.format(
            `import * as React from "react";
		import * as ReactDom from "react-dom";
		export class Defs extends React.Component<any, any> {
			static jicPath: string = "./defs.svg";
			static jic: Record<${JicKey}, string|Record<"contextStrokeDashoffset", number>> = ${JSON.stringify(
              jic,
              null,
              "  "
            )};
			constructor(props) {
				super(props);
			}
			render() {
				return <g id="jic-defs" dangerouslySetInnerHTML={{
						__html: '${data}'
					}}/>
			}
		}`,
            { parser: "babylon" }
          );
        });
      });
  },
  edges: function({
    themeName,
    themeSpecPropertyName,
    themeSpecParsedPropertyValue
  }) {
    const bundledEdges = bundleBySelectiveExportFromKaavio({
      tagName: "edges",
      themeSpecParsedPropertyValue
    });
    return hl([bundledEdges]);
  }
  /*
  styles: bundleStyles
  //*/
};

program
  .version(npmPackage.version)
  .description("Control and customize Kaavio from the command line.");

program
  .command("bundle themeNameOrPathToThemeSpec")
  .option(
    "-o, --out [string]",
    `Where to save the bundle. Note: If a themeSpec (JSON file that specifies a theme) is provided,
	  the "out" arg defaults to the directory containing the themeSpec.`
  )
  .option(
    "-p, --preserve-aspect-ratio [name1,name2,name3...]",
    `Preserve original aspect ratio of def(s).
		-p: preserve for all defs (notice no value specified)
		-p name1 name2 name3: preserve for the def(s) with the specified name(s)
		not specified: don't preserve for any defs (all defs stretch to fit their container)`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .option(
    "--clipPaths [name1=path,name2=path,name3=path...]",
    `Include the clipPaths specified.
    Example:
			--clipPaths ClipPathRoundedRectangle=./src/themes/clipPaths/ClipPathRoundedRectangle.svg#ClipPathRoundedRectangle
	`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .option(
    "--filters [name1,name2,name3...]",
    `Include the filters specified. If argument not specified, default is to include all Kaavio filters.
    Example:
			--filters FilterWhiteToBlue=./src/themes/filters/FilterWhiteToBlue.svg#FilterWhiteToBlue
	`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .option(
    "--edges [name1,name2,name3...]",
    `Include the edges specified. If argument not specified, default is to include all Kaavio edges.
    Example:
			--edges StraightLine CurvedLine ElbowLine SegmentedLine
	`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .option(
    "--symbols [name1=path,name2=path,name3=path...]",
    `Include the symbols specified.
    Example:
			--symbols Ellipse=./src/themes/symbols/Ellipse.svg
	`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .action(function(themeNameOrPathToThemeSpec: string, options) {
    const themeSpecPropertyProcessorNames = keys(processThemeSpecPropertyFor);
    console.log(`Bundling...`);

    let themeSpecParsedStream;
    if (themeNameOrPathToThemeSpec.match(/\.json$/)) {
      // NOTE: JSON themeSpec file provided.
      // TODO should we check that the user doesn't provide args that conflict
      // with what's specified in the themeSpec?
      const themeName = path
        .basename(themeNameOrPathToThemeSpec)
        .replace(/\.json$/, "");

      const out = options.out || path.dirname(themeNameOrPathToThemeSpec);

      themeSpecParsedStream = get(themeNameOrPathToThemeSpec)
        .through(JSONStream.parse())
        .map(function(themeSpec) {
          //const { preserveAspectRatio } = themeSpec;
          return themeSpecPropertyProcessorNames.reduce(
            function(acc, themeSpecPropertyProcessorName) {
              acc[themeSpecPropertyProcessorName] = parseThemeSpecPropertyPair(
                themeNameOrPathToThemeSpec,
                [
                  themeSpecPropertyProcessorName,
                  themeSpec[themeSpecPropertyProcessorName]
                ]
              );
              return acc;
            },
            { themeName, out }
          );
        });
    } else {
      const { out } = options;

      //return {pick(themeSpecPropertyProcessorNames, options)};
      // TODO this is broken
      throw new Error("CLI via args not working ATM!");
      //themeSpecStream = hl([]);
      /*
      const thisPreserveAspectRatio =
        preserveAspectRatio === true ||
        (isArray(preserveAspectRatio) &&
          preserveAspectRatio.indexOf(name) > -1);
      themeSpecStream = hl([
        themeSpecPropertyProcessorNames.reduce(function(acc, themeSpecPropertyProcessorName) {
          acc[themeSpecPropertyProcessorName] = uniq(acc[themeSpecPropertyProcessorName]).reduce(
            function(subAcc, def) {
              const defParts = def.split("=");
              const defName = defParts[0];
              const defLocation = defParts.slice(1).join("=");
              subAcc[defName] = defLocation;
              return subAcc;
            },
            { name, out, preserveAspectRatio }
          );
          return acc;
        })
      ]);
	    //*/
    }

    themeSpecParsedStream
      .flatMap(function(themeSpecParsed) {
        const { themeName, out } = themeSpecParsed;
        // ["edges"]
        return hl(toPairs(themeSpecParsed))
          .filter(
            ([themeSpecPropertyName, themeSpecPropertyValue]) =>
              themeSpecPropertyProcessorNames.indexOf(themeSpecPropertyName) >
              -1
          )
          .flatMap(function([
            themeSpecPropertyName,
            themeSpecParsedPropertyValue
          ]) {
            return processThemeSpecPropertyFor[themeSpecPropertyName]({
              themeName,
              themeSpecPropertyName,
              themeSpecParsedPropertyValue
            });
          })
          .through(function(s) {
            const outPath = path.join(out, `/${themeName}/theme.tsx`);
            return pipeToFilepath(s, outPath);
          });
      })
      .errors(function(err) {
        console.error("err");
        console.error(err);
        process.exitCode = 1;
      })
      .toArray(function(results) {
        console.log(`Successfully completing bundling.`);
        console.log(`Rebuild your project to make changes take effect`);
        //process.exitCode = 0;
      });
  })
  .on("--help", function() {
    console.log(`
			Examples:

			$ kaavio bundle Ellipse=./src/drawers/defs/Ellipse.svg -o ./src/themes/dark.tsx

			You can use external SVG icons sources for defs. For example:
				https://commons.wikimedia.org/wiki/Category:SVG_icons
				https://www.github.com/encharm/Font-Awesome-SVG-PNG
				https://useiconic.com/open
				https://thenounproject.com/term/biology/1130/
				https://www.flaticon.com/free-icons/biology_23352
				
				http://www.simolecule.com/cdkdepict/depict.html -- You can use BridgeDb to get the SMILES string, e.g.:

					curl http://webservice.bridgedb.org/Human/attributes/Ch/HMDB00161?attrName=SMILES
					=> CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C

					Then append the SMILES string to "http://www.simolecule.com/cdkdepict/depict/bow/svg?smi=" to get
					http://www.simolecule.com/cdkdepict/depict/bow/svg?smi=CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C


			Note that most SVG glyph sets expect a fill color but not a stroke.

			Bundle a local icon and a remote one

				$ kaavio bundle Ellipse=./src/drawers/defs/Ellipse.svg \\
				RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px \\
				-o ./src/themes/dark.tsx

				Note: the hash and value "#ic_check_box_outline_blank_24px" after the Wikimedia
				URL means we want to use the element with id "ic_check_box_outline_blank_24px"
				from INSIDE the SVG specified by the URL.

			Bundle several icons, setting two of them to retain their original aspect ratios

				$ kaavio bundle defs Brace=https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg \\
				Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg \\
				Mitochondria=http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg \\
				RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px \\
				wikidata:Q218642="http://www.simolecule.com/cdkdepict/depict/bow/svg?smi=CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C" \\
				--preserve-aspect-ratio=wikidata:Q218642 Mitochondria
				-o ./src/themes/dark.tsx

			Bundle icons as specified in a def map JSON file:

				$ kaavio bundle ./src/themes/dark.json -o ./src/themes/dark.tsx
							`);
    // also allowed:
    //console.log("    $ kaavio bundle markers '*'");
    /*
./bin/kaavio bundle defs '*' Brace=https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg Mitochondria=http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px --preserve-aspect-ratio=Mitochondria


./bin/kaavio bundle defs '*' Brace="https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg" \
				Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg \
				Mitochondria="http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg" \
				RoundedRectangle="https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px" \
				wikidata:Q218642="http://www.simolecule.com/cdkdepict/depict/bow/svg?smi=CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C" \
				--preserve-aspect-ratio=wikidata:Q218642 Mitochondria
//*/
    //
  });

program.parse(process.argv);

// If no command is specified, output help.
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
