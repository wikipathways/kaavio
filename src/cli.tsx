import "source-map-support/register";

const fs = require("fs-extra");
import * as ndjson from "ndjson";
const JSONStream = require("JSONStream");
import * as path from "path";
import { DOMParser } from "xmldom";
import { Base64 } from "js-base64";

import { MarkerProperty } from "./types";
import { createMarkerId, MARKER_PROPERTIES } from "./components/Marker/helpers";

import {
  assign,
  camelCase,
  curry,
  defaultsDeep,
  isArray,
  isEmpty,
  isFinite,
  keys,
  //flow,
  fromPairs,
  partition,
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

import { Diagram } from "./components/Diagram";
import { arrayify } from "./spinoffs/jsonld-utils";

const NS = {
  svg: "http://www.w3.org/2000/svg"
};

const npmPackage = require("../package.json");
const exec = hl.wrapCallback(require("child_process").exec);

const ensureFile = hl.wrapCallback(fs.ensureFile);
const readFile = hl.wrapCallback(fs.readFile);

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

program
  .version(npmPackage.version)
  .description("Control and customize Kaavio from the command line.");

const STRING_TO_BOOLEAN = {
  true: true,
  false: false
};

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

const bundleBySelectiveImport = curry(function(
  name,
  inputs,
  { preserveAspectRatio }
) {
  const whatToImport = isEmpty(inputs) || inputs[0] === "*"
    ? `*`
    : "{" +
        uniq(
          inputs.map(function(input: string) {
            if (!isVarName(input)) {
              throw new Error(
                `Input item "${input}" is not a valid name.
	Suggested Replacement: ${getSuggestedVarName(input)}
	Must be a valid JS identifier <https://tc39.github.io/ecma262/#prod-Identifier>`
              );
            }
            return input;
          })
        ).join(", ") +
        "}";

  console.log(`Importing "${whatToImport}"`);

  const bundledDrawerCode =
    ` //import "source-map-support/register";
    export ${whatToImport} from "./index";
		` + "\n";

  return hl([bundledDrawerCode]);
});

function bundleStyles(inputs: string[]) {
  // NOTE: we're not accepting CSS strings. Must be filepaths.
  const strippedInputs = inputs.map((input: string) =>
    input.replace("file://", "")
  );
  const [typeStyleFileInputs, nonTypeStyleFileInputs] = partition(
    strippedInput => strippedInput.match(/\.style.tsx$/),
    strippedInputs
  );
  const cssStream = hl(nonTypeStyleFileInputs)
    .flatMap(get)
    .collect()
    .map(function(styleStrings) {
      return styleStrings.join("").replace(/[\r\n]/g, "");
    });

  const typeStyleExportString =
    typeStyleFileInputs
      .map(function(typeStyleFilepath) {
        return path.resolve(typeStyleFilepath).replace(/\.tsx$/, "");
      })
      .map(function(modulePath) {
        return `export * from "${modulePath}"`;
      })
      .join("\n") || "export const _placeholder = 1;";

  return cssStream
    .filter(cssString => cssString !== "")
    .doto(x => console.log("css"))
    .doto(console.log)
    .map(
      cssString => `import { cssRaw } from 'typestyle';
cssRaw(${cssString || ""})`
    )
    .otherwise([""])
    .map(function(cssRawTypeStyleString) {
      return `${cssRawTypeStyleString}
${typeStyleExportString}`;
    })
    .errors(function(err, push) {
      err.message = err.message || "";
      err.message += ` in bundleDefs(${JSON.stringify(inputs)})`;
      push(err);
    });
}

function surroundWithFlip180Container(markerEl, markerWidth, markerHeight) {
  var dom = new DOMParser().parseFromString(`<svg xmlns="${NS.svg}" />`);
  const container = dom.createElementNS(NS.svg, "g");
  container.setAttribute(
    "transform",
    `rotate(180, ${markerWidth / 2}, ${markerHeight / 2})`
  );

  /* Strange that the following doesn't work
  const childNodeClones = markerEl.cloneNode(true).childNodes || [];
  const childNodes = markerEl.childNodes || [];
  for (let i = 0; i < childNodeClones.length; i++) {
    container.appendChild(childNodeClones[i].cloneNode(true));
    markerEl.removeChild(childNodes[i]);
  }
  //*/

  //* It doesn't seem the following should be any different than what's above, but it is:
  const childNodeClones = markerEl.cloneNode(true).childNodes || [];
  for (let i = 0; i < childNodeClones.length; i++) {
    container.appendChild(childNodeClones[i].cloneNode(true));
  }
  do {
    markerEl.removeChild(markerEl.firstChild);
  } while (markerEl.hasChildNodes());
  //*/

  markerEl.appendChild(container);
  return markerEl;
}

const markerPropertyToRefXMultiplierMap: Record<MarkerProperty, number> = {
  marker: 0.5,
  markerStart: 0,
  markerMid: 0.5,
  markerEnd: 1
};

const defProcessorMap = {
  clipPaths: function(node, { preserveAspectRatio }) {
    return [{ node, cache: {} }];
  },
  filters: function(node, { preserveAspectRatio }) {
    //const childNodes = node.childNodes;
    const feColorMatrices = node.getElementsByTagNameNS(
      NS.svg,
      "feColorMatrix"
    );
    for (let i = 0; i < feColorMatrices.length; i++) {
      const feColorMatrix = feColorMatrices[i];
      if (feColorMatrix.hasAttribute("values")) {
        const values = feColorMatrix.getAttribute("values");
        const updatedValues = values.trim().replace(/[\r\n]/g, " ");
        if (values !== updatedValues) {
          console.warn(`\tWarning: Safari cannot handle untrimmed filter values.
    	See https://stackoverflow.com/a/39335132/5354298
	Converting:
	${values}
	to:
	${updatedValues}`);
          feColorMatrix.setAttribute("values", updatedValues);
        }
      }
    }
    return [{ node, cache: {} }];
  },
  markers: function(node, { preserveAspectRatio }) {
    const id = node.getAttribute("id");

    const markerWidth = parseFloat(node.getAttribute("markerWidth"));
    if (!isFinite(markerWidth)) {
      throw new Error(
        `markerWidth "${markerWidth}" for ${id} is not a finite number.`
      );
    }

    const markerHeight = parseFloat(node.getAttribute("markerHeight"));
    if (!isFinite(markerHeight)) {
      throw new Error(
        `markerHeight "${markerHeight}" for ${id} is not a finite number.`
      );
    }

    if (!node.hasAttribute("stroke-dasharray")) {
      // TODO watch for Safari to fix its behavior related to this.
      // Chrome and FF don't apply the stroke-dasharray of the
      // edge to the marker, but Safari does.
      node.setAttribute("stroke-dasharray", 99999);
    }

    if (!node.hasAttribute("refY")) {
      node.setAttribute("refY", markerHeight / 2);
    }
    if (!node.hasAttribute("viewBox")) {
      node.setAttribute("viewBox", `0 0 ${markerWidth} ${markerHeight}`);
    }
    return MARKER_PROPERTIES.map(function(markerProperty) {
      const nodeClone = node.cloneNode(true);
      const markerForThisProperty = markerProperty === "markerStart"
        ? surroundWithFlip180Container(nodeClone, markerWidth, markerHeight)
        : nodeClone;

      const updatedId = createMarkerId(markerProperty, id);
      nodeClone.setAttribute("id", updatedId);

      if (!node.hasAttribute("refX")) {
        nodeClone.setAttribute(
          "refX",
          markerPropertyToRefXMultiplierMap[markerProperty] * markerWidth
        );
      }
      const contextStrokeDashoffset = parseFloat(
        nodeClone.getAttribute("data-context-stroke-dashoffset")
      );
      return {
        node: nodeClone,
        cache: {
          [updatedId]: {
            contextStrokeDashoffset: isFinite(contextStrokeDashoffset)
              ? contextStrokeDashoffset
              : markerHeight
          }
        }
      };
    });
  },
  patterns: function(node, { preserveAspectRatio }) {
    return [{ node, cache: {} }];
  },
  symbols: function(node, { preserveAspectRatio }) {
    const id = node.getAttribute("id");
    const nodeClass = node.getAttribute("class") || "";
    //node.setAttribute("class", `${nodeClass} ${name}`);
    if (preserveAspectRatio) {
      node.setAttribute("preserveAspectRatio", "xMidYMid");
    } else {
      node.setAttribute("preserveAspectRatio", "none");
    }

    const viewBox = node.getAttribute("viewBox");
    if (!viewBox) {
      const width = node.getAttribute("width") || 200;
      const height = node.getAttribute("height") || 100;
      if (!width || !height) {
        throw new Error(`Cannot set viewBox for ${id}.`);
      }
      node.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = node
      .getAttribute("viewBox")
      .split(/[\ ,]/);
    const x = node.getAttribute("x");
    const y = node.getAttribute("y");
    if (!isFinite(x) || !isFinite(y) || x > viewBoxWidth || y > viewBoxHeight) {
      node.setAttribute("x", viewBoxX);
      node.setAttribute("y", viewBoxY);
    }
    return [{ node, cache: {} }];
  }
};

function bundleDefs(defType, defMap, { preserveAspectRatio }) {
  console.log("Importing:");
  const processedStream = hl.pairs(defMap).flatMap(function([name, defPath]) {
    const thisPreserveAspectRatio =
      preserveAspectRatio === true ||
      (isArray(preserveAspectRatio) && preserveAspectRatio.indexOf(name) > -1);
    console.log(`  ${name}
	source: ${defPath}
	preserveAspectRatio: ${thisPreserveAspectRatio}`);
    const [url, idAsSetInSource] = defPath.split("#");
    // NOTE: data URI parsing is a variation of code from
    // https://github.com/killmenot/parse-data-url/blob/master/index.js
    let svgStringStream;
    if (validDataUrl(url)) {
      const parts = url.match(validDataUrl.regex);
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

      const decoded = !isBase64
        ? decodeURIComponent(data)
        : Base64.decode(data);
      svgStringStream = hl([decoded]);
    } else {
      const strippedPath = url.replace("file://", "");
      if (urlRegex({ strict: true, exact: true }).test(strippedPath)) {
        svgStringStream = get(strippedPath);
      } else {
        svgStringStream = get(strippedPath);
      }
    }

    return svgStringStream.flatMap(function(svgString) {
      const doc = new DOMParser().parseFromString(svgString);
      const node = !idAsSetInSource
        ? doc.documentElement
        : doc.getElementById(idAsSetInSource);
      // NOTE: "name" may or may not equal "idAsSetInSource", which is
      //       the element id in the source SVG.
      node.setAttribute("id", name);
      //const tagName = node.tagName;
      return hl(
        !!defProcessorMap[defType]
          ? defProcessorMap[defType](node, {
              preserveAspectRatio: thisPreserveAspectRatio
            })
          : [node]
      ).map(function({ node, cache }) {
        return {
          id: node.getAttribute("id"),
          defType,
          svgString: node.toString(),
          cache
        };
      });
    });
  });

  processedStream
    .observe()
    .filter(({ defType }) => defType === "symbols")
    .map(({ id }) => id)
    .toArray(function(ids) {
      if (ids.length > 0) {
        const suggestedFillOnlyCSS = ids
          .map((id, i) => `#${id} {fill: currentColor; stroke: none;}`)
          .join("\n\t");

        console.log(`
Note that most SVG glyph sets expect a fill color but not a stroke.
To disable stroke for your def(s) and enable fill, add this to the CSS string for Kaavio prop style.diagram:

<style xmlns="${NS.svg}" type="text/css">
	<![CDATA[
	${suggestedFillOnlyCSS}
	]]>
</style>
`);
      }
    });

  return processedStream
    .reduce({ svgString: "", cache: {} }, function(acc, { svgString, cache }) {
      acc.svgString += svgString;
      acc.cache = defaultsDeep(acc.cache, cache);
      return acc;
    })
    .errors(function(err, push) {
      err.message = err.message || "";
      err.message += ` in bundleDefs(${JSON.stringify(defMap)})`;
      push(err);
    });
}

function resolveDefMapPaths(configPath, defMap) {
  return fromPairs(
    toPairs(defMap).map(function([key, value]) {
      if (value.indexOf("http") === 0) {
        return [key, value];
      }
      const [pathRelativeToJSONFile, id] = value
        .replace("file://", "")
        .split("#");
      const pathRelativeToCWD = path.resolve(
        path.dirname(configPath),
        pathRelativeToJSONFile
      );
      return [key, value.replace(pathRelativeToJSONFile, pathRelativeToCWD)];
    })
  );
}

program
  .command("bundle nameOrConfigPath")
  .option(
    "-o, --out [string]",
    `Where to save the bundle. If JSON config file provided, out defaults to directory containing that file.`
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
  .action(function(nameOrConfigPath: string, options) {
    console.log(`Bundling...`);
    const defProcessorNames = keys(defProcessorMap);

    let themeMapStream;
    if (nameOrConfigPath.match(/\.json$/)) {
      // NOTE: JSON config file provided.
      const name = path.basename(nameOrConfigPath).replace(/\.json$/, "");
      const out = options.out || path.dirname(nameOrConfigPath);
      themeMapStream = get(nameOrConfigPath)
        .through(JSONStream.parse())
        .map(function(options) {
          const { preserveAspectRatio } = options;
          return defProcessorNames.reduce(
            function(acc, defProcessorName) {
              acc[defProcessorName] = resolveDefMapPaths(
                nameOrConfigPath,
                options[defProcessorName]
              );
              return acc;
            },
            { name, out, preserveAspectRatio }
          );
        });
    } else {
      const { out } = options;
      const preserveAspectRatio =
        options.hasOwnProperty("preserveAspectRatio") &&
        options.preserveAspectRatio;

      themeMapStream = hl([
        defProcessorNames.reduce(function(acc, defProcessorName) {
          acc[defProcessorName] = uniq(acc[defProcessorName]).reduce(
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
    }

    themeMapStream
      .flatMap(function(themeMap) {
        const { name, out, preserveAspectRatio } = themeMap;
        return hl(toPairs(themeMap))
          .filter(
            ([defType, defMap]) => defProcessorNames.indexOf(defType) > -1
          )
          .flatMap(function([defType, defMap]) {
            return bundleDefs(defType, defMap, {
              preserveAspectRatio
            });
          })
          .reduce({ svgString: "", cache: {} }, function(
            acc,
            { svgString, cache }
          ) {
            acc.svgString += svgString;
            acc.cache = defaultsDeep(acc.cache, cache);
            return acc;
          })
          .map(function({ svgString, cache }) {
            const joinedSvgString = svgString.replace(/[\r\n]/g, "");
            console.log("Caching the following extracted data:");
            console.log(cache);

            const cacheKeys = keys(cache).map(k => `"${k}"`).join("|");
            const cacheString = JSON.stringify(cache);

            // TODO look at using an SVG to JSX converter instead of using dangerouslySetInnerHTML
            return (
              `//import "source-map-support/register";
		import * as React from "react";
		import * as ReactDom from "react-dom";
		export class Defs extends React.Component<any, any> {
			static cache: Record<${cacheKeys}, Record<"contextStrokeDashoffset", number>> = ${cacheString};
			constructor(props) {
				super(props);
			}
			render() {
				return <g id="bundled-defs-${name}" dangerouslySetInnerHTML={{
						__html: '${joinedSvgString}'
					}}/>
			}
		}` + "\n"
            );
          })
          .flatMap(function(result) {
            return pipeToFilepath(
              hl([result]),
              path.join(out, `__bundles_dont_edit__/${name}/Defs.tsx`)
            );
          });
      })
      .errors(function(err) {
        console.error(err);
        process.exitCode = 1;
      })
      .toArray(function() {
        console.log(`Successfully completing bundling.`);
        console.log(`Rebuild your project to make changes take effect`);
        process.exitCode = 0;
      });
  })
  .on("--help", function() {
    console.log(`
			Examples:

			$ kaavio bundle Ellipse=./src/drawers/defs/Ellipse.svg -o ./src/themes/__bundled_dont_edit__/dark.tsx

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
				-o ./src/themes/__bundled_dont_edit__/dark.tsx

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
				-o ./src/themes/__bundled_dont_edit__/dark.tsx

			Bundle icons as specified in a def map JSON file:

				$ kaavio bundle ./src/themes/dark.json -o ./src/themes/__bundled_dont_edit__/dark.tsx
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

/*
hl(source).map(x => hl([x]))
.each(function(jsonStream) {
  jsonStream
    .errors(function(err) {
      console.error(err);
      process.exit(1);
    })
    .map(x => String(x))
    .pipe(process.stdout);
});
//*/

program.parse(process.argv);

// If no command is specified, output help.
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
