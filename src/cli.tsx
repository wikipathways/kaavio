import "source-map-support/register";

const fs = require("fs-extra");
import * as ndjson from "ndjson";
import * as path from "path";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { DOMParser } from "xmldom";
import * as JSONStream from "JSONStream";
import { Base64 } from "js-base64";

import * as edgeDrawerMap from "./drawers/edges/__bundled_dont_edit__";
import * as filterDrawerMap from "./drawers/filters/__bundled_dont_edit__";
import * as markerDrawerMap from "./drawers/markers/__bundled_dont_edit__";
import * as customStyle from "./drawers/styles/__bundled_dont_edit__";
import { Icons } from "./drawers/icons/__bundled_dont_edit__";

import {
  assign,
  camelCase,
  //compact,
  curry,
  defaults,
  isArray,
  isEmpty,
  isFinite,
  isString,
  keys,
  //flow,
  fromPairs,
  partition,
  toPairs,
  union,
  uniq,
  upperFirst,
  values
} from "lodash/fp";

import * as React from "react";
import * as ReactDOM from "react-dom";

// TODO why doesn't "import * as name" work with Webpack for the following packages?
const hl = require("highland");
const isVarName = require("is-valid-var-name");
const getit = require("getit");
const parent = require("parent-package-json");
import { Parser, Validator } from "collit";
const program = require("commander");
const urlRegex = require("url-regex");
const validDataUrl = require("valid-data-url");
const VError = require("verror");

import { Diagram } from "./components/Diagram";
import { arrayify } from "../src/spinoffs/jsonld-utils";

const npmPackage = require("../package.json");
const exec = hl.wrapCallback(require("child_process").exec);
const pathToParent0 = parent(__dirname) ? parent(__dirname).path : false;
const pathToParent1 = parent(__dirname, 1) ? parent(__dirname, 1).path : false;
const dirs = uniq(
  [pathToParent1 || pathToParent0 || path.join(__dirname, "..")]
    .filter(p => !!p)
    .map(p => p.replace(/package\.json$/, ""))
);
/*
console.log(`__dirname: ${__dirname}`);
console.log(`pathToParent0: ${pathToParent0}`);
console.log(`pathToParent1: ${pathToParent1}`);
console.log("dirs");
console.log(dirs);
//*/

const BUILTIN_ICONS_DIR = path.join(__dirname, "../src/drawers/icons/");
const ICONS_BUNDLE_PATH = path.join(
  BUILTIN_ICONS_DIR,
  "__bundled_dont_edit__.tsx"
);

const readdir = hl.wrapCallback(fs.readdir);
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

function build() {
  console.log("Rebuilding Kaavio (may take some time)...");

  // NOTE: we want to build from the top level of the package.
  // __dirname is kaavio/src/, even after compilation.
  // We want either kaavio/ or else PKG-DEPENDING-ON-KAAVIO/
  const targetCWD = dirs[0];

  const webpackProdConfigPath = path.resolve(
    targetCWD,
    path.join(__dirname, "../webpack.lib.prod.config.js")
  );

  return exec(`webpack --config ${webpackProdConfigPath}`, {
    cwd: targetCWD
  })
    .last()
    .doto(x => console.log("Build complete."));
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

function getIconMap(inputs: string[]) {
  return readdir(BUILTIN_ICONS_DIR).flatMap(function(filenames) {
    const allLocalIconNames = filenames
      .filter(filename => filename.slice(-4) === ".svg")
      .map(filename => filename.slice(0, -4));

    if (isEmpty(inputs)) {
      inputs = allLocalIconNames;
    } else if (inputs[0] === "*") {
      inputs = union(allLocalIconNames, inputs.slice(1));
    }

    return hl(uniq(inputs))
      .flatMap(function(input) {
        if (allLocalIconNames.indexOf(input) > -1) {
          return hl([
            {
              [input]: `file://${BUILTIN_ICONS_DIR}${input}.svg#${input}`
            }
          ]);
        } else if (input.indexOf("=") > -1) {
          const inputParts = input.split("=");
          const iconName = inputParts[0];
          const iconLocation = inputParts.slice(1).join("=");
          return hl([
            {
              [iconName]: iconLocation
            }
          ]);
        } else {
          // User must have specified an icon map saved as a JSON file.
          return get(input).through(ndjson.parse()).map(function(iconMap) {
            return fromPairs(
              toPairs(iconMap).map(function([key, value]) {
                const [pathRelativeToJSONFile, id] = value
                  .replace("file://", "")
                  .split("#");
                const pathRelativeToCWD = path.resolve(
                  path.dirname(input),
                  pathRelativeToJSONFile
                );
                return [
                  key,
                  value.replace(pathRelativeToJSONFile, pathRelativeToCWD)
                ];
              })
            );
          });
        }
      })
      .reduce1(function(acc, iconMap) {
        return assign(acc, iconMap);
      });
  });
}

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
      err.message += ` in bundleIcons(${JSON.stringify(inputs)})`;
      push(err);
    });
}

function bundleIcons(inputs, { preserveAspectRatio }) {
  const iconStream = getIconMap(inputs)
    .flatMap(function(iconMap) {
      console.log("Importing:");
      return hl
        .pairs(iconMap)
        .flatMap(function([name, iconPath]) {
          const thisPreserveAspectRatio =
            preserveAspectRatio === true ||
            (isArray(preserveAspectRatio) &&
              preserveAspectRatio.indexOf(name) > -1);
          console.log(`  ${name}
	source: ${iconPath}
	preserveAspectRatio: ${thisPreserveAspectRatio}`);
          const [url, idInSource] = iconPath.split("#");
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

          return svgStringStream.map(function(svgString) {
            const doc = new DOMParser().parseFromString(svgString);
            const node = !idInSource
              ? doc.documentElement
              : doc.getElementById(idInSource);
            // NOTE: "name" may or may not equal "idInSource", which is
            //       the element id in the source SVG.
            node.setAttribute("id", name);
            const nodeClass = node.getAttribute("class") || "";
            node.setAttribute("class", `${nodeClass} Icon ${name}`);
            if (thisPreserveAspectRatio) {
              node.setAttribute("preserveAspectRatio", "xMidYMid");
            } else {
              node.setAttribute("preserveAspectRatio", "none");
            }

            const viewBox = node.getAttribute("viewBox");
            if (!viewBox) {
              const width = node.getAttribute("width") || 200;
              const height = node.getAttribute("height") || 100;
              if (!width || !height) {
                throw new Error(`Cannot set viewBox for ${name}.`);
              }
              node.setAttribute("viewBox", `0 0 ${width} ${height}`);
            }
            const [
              viewBoxX,
              viewBoxY,
              viewBoxWidth,
              viewBoxHeight
            ] = node.getAttribute("viewBox").split(/[\ ,]/);
            const x = node.getAttribute("x");
            const y = node.getAttribute("y");
            if (
              !isFinite(x) ||
              !isFinite(y) ||
              x > viewBoxWidth ||
              y > viewBoxHeight
            ) {
              node.setAttribute("x", viewBoxX);
              node.setAttribute("y", viewBoxY);
            }
            return node.toString();
          });
        })
        .collect()
        .map(function(svgStrings) {
          const iconNames = keys(iconMap);
          const suggestedFillOnlyCSS = iconNames
            .map(
              (iconName, i) =>
                `.Icon.${iconName} {fill: currentColor; stroke: none;}`
            )
            .join("\n\t");

          console.log(`
Note that most SVG glyph sets expect a fill color but not a stroke.
To disable stroke for your icon(s) and enable fill, you can use this in your custom CSS:

<style xmlns="http://www.w3.org/2000/svg" type="text/css">
	<![CDATA[
	${suggestedFillOnlyCSS}
	]]>
</style>
`);
          const joinedIconNamesString = iconNames.join("");
          const joinedSvgString = svgStrings.join("").replace(/[\r\n]/g, "");
          // TODO look at using an SVG to JSX converter instead of using dangerouslySetInnerHTML
          return (
            `//import "source-map-support/register";
							import * as React from "react";
							import * as ReactDom from "react-dom";
							export class Icons extends React.Component<any, any> {
								constructor(props) {
									super(props);
								}

								render() {
									return <g id="icon-defs-${joinedIconNamesString}" dangerouslySetInnerHTML={{
											__html: '${joinedSvgString}'
										}}/>
								}
							}` + "\n"
          );
        });
    })
    .errors(function(err, push) {
      err.message = err.message || "";
      err.message += ` in bundleIcons(${JSON.stringify(inputs)})`;
      push(err);
    });

  return iconStream;
}

const bundlerMap = {
  edges: bundleBySelectiveImport("edges"),
  filters: bundleBySelectiveImport("filters"),
  icons: bundleIcons,
  markers: bundleBySelectiveImport("markers"),
  styles: bundleStyles
};

program
  .command("bundle <whatToBundle> [input...]")
  .option(
    "-b, --build <boolean>",
    `Automatically rebuild after bundling so changes take effect. Default: true.`,
    (s: string) => s === "true"
  )
  .option(
    "-p, --preserve-aspect-ratio [name1,name2,name3...]",
    `Preserve original aspect ratio of icon(s).
		--build: preserve for all icons (notice no value specified)
		--build name1 name2 name3: preserve for the icon(s) with the specified name(s)
		not specified: don't preserve for any icons (all icons stretch to fit their container)`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .action(function(whatToBundle, inputs: string[], options) {
    console.log(`Bundling ${whatToBundle}...`);

    const buildAutomatically = options.hasOwnProperty("build")
      ? options.build
      : true;
    const preserveAspectRatio =
      options.hasOwnProperty("preserveAspectRatio") &&
      options.preserveAspectRatio;

    if (!bundlerMap.hasOwnProperty(whatToBundle)) {
      const cmdSuggestions = keys(bundlerMap)
        .map(key => `\tkaavio bundle ${key} ${inputs.join(", ")}`)
        .join("\r\n");
      throw new Error(
        `"${whatToBundle}" is not a supported whatToBundle option. Supported options: \r\n${cmdSuggestions}\r\n`
      );
    }

    const bundler = bundlerMap[whatToBundle];

    const bundlePath: string = path.join(
      __dirname,
      `../src/drawers/${whatToBundle}/`,
      `__bundled_dont_edit__.tsx`
    );

    const bundlerStream = bundler(inputs, {
      preserveAspectRatio
    });

    pipeToFilepath(bundlerStream, bundlePath)
      .flatMap(function() {
        console.log(`Successfully bundled ${whatToBundle}.`);

        if (buildAutomatically) {
          return build();
        } else {
          console.log(
            `Rebuild Kaavio to make changes take effect: npm run build`
          );
          return hl([]);
        }
      })
      .errors(function(err) {
        console.error(err);
        process.exitCode = 1;
      })
      .last()
      .each(function(x) {
        process.exitCode = 0;
      });
  })
  .on("--help", function() {
    console.log(`
			Valid <whatToBundle> values: ${keys(bundlerMap).join(", ")}

			Examples:

			##################
			# Bundle markers #
			##################

			Include all built-ins:
			$ kaavio bundle markers

			Include only selected built-ins:
			$ kaavio bundle markers Arrow TBar

			################
			# Bundle icons #
			################

			Include all built-ins:
			$ kaavio bundle icons

			Include only selected built-ins:
			$ kaavio bundle icons Ellipse Rectangle

			You can also use external SVG icons sources, such as:
				https://commons.wikimedia.org/wiki/Category:SVG_icons
				https://www.github.com/encharm/Font-Awesome-SVG-PNG
				https://useiconic.com/open
				https://thenounproject.com/term/biology/1130/
				https://www.flaticon.com/free-icons/biology_23352
				http://cdkdepict-openchem.rhcloud.com/depict.html
					Use BridgeDb to get the SMILES string:
					http://webservice.bridgedb.org/Human/attributes/Ch/HMDB00161?attrName=SMILES

			Note that most SVG glyph sets expect a fill color but not a stroke.

			Include a built-in icon and one from Wikimedia (the hash and value
				"#ic_check_box_outline_blank_24px" after the Wikimedia URL means we
				want to use the element with id "ic_check_box_outline_blank_24px"
				from INSIDE the SVG specified by the URL):
			$ kaavio bundle icons Ellipse \\
				RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px

			Include all built-ins, but override the ones for Brace, Ellipse,
				Mitochondria and RoundedRectangle.
				Set wikidata:Q218642 (L-Alanine) and Mitochondria to retain their original aspect ratios.
			$ kaavio bundle icons '*' Brace=https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg \\
				Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg \\
				Mitochondria=http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg \\
				RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px \\
				wikidata:Q218642="http://cdkdepict-openchem.rhcloud.com/depict/bow/svg?smi=CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C" \\
				--preserve-aspect-ratio=wikidata:Q218642 Mitochondria

			Include the icons specified in an icon map JSON file:
			$ kaavio bundle icons ./src/drawers/icons/defaultIconMap.json

			################
			# Bundle edges #
			################

			Include all built-ins:
			$ kaavio bundle edges

			Include only selected built-ins:
			$ kaavio bundle edges StraightLine CurvedLine ElbowLine SegmentedLine
							`);
    // also allowed:
    //console.log("    $ kaavio bundle markers '*'");
    /*
./bin/kaavio bundle icons '*' Brace=https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg Mitochondria=http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px --preserve-aspect-ratio=Mitochondria


./bin/kaavio bundle icons '*' Brace="https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg" \
				Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg \
				Mitochondria="http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg" \
				RoundedRectangle="https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px" \
				wikidata:Q218642="http://cdkdepict-openchem.rhcloud.com/depict/bow/svg?smi=CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C" \
				--preserve-aspect-ratio=wikidata:Q218642 Mitochondria

cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | jq -c '(. | .entityMap[] | select(.dbId == "HMDB00161")) as {id: $id} | .entityMap[$id].drawAs |= "wikidata:Q218642" | .entityMap[$id].height=81' | ./bin/kaavio json2svg --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP106.json | jq -c '(. | .entityMap[] | select(has("wikidata"))) as {id: $id, width: $width, wikidata: $wikidata} | .entityMap[$id].drawAs |= $wikidata | .entityMap[$id].height |= $width' | ./bin/kaavio json2svg --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-gpml-Homo_sapiens/Hs_Apoptosis-related_network_due_to_altered_Notch3_in_ovarian_cancer_WP2864_79278.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/kaavio json2svg --highlight red=abd6e > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP2864.json | ./bin/kaavio json2svg --highlight green=b99fe,ensembl:ENSG00000124762 > output.svg

TODO what about coloring of text vs. edge for Chloroplast in this pathway:
http://www.wikipathways.org/index.php/Pathway:WP2623
//*/
    //
  });

program
  .command("json2svg [inputPath] [outputPath]")
  .description("Convert Kaavio-formatted JSON into SVG")
  .option(
    "-s, --static [boolean]",
    "Exclude extra DOM attributes, such as data-reactid, that React uses internally. Default: true",
    (s: string) => ["", "true"].indexOf(s) > -1
  )
  .option(
    "--hide [target1,target2,target3...]",
    `Specify entities to hide. 
		target: entity id, type or textContent

		Examples:
			--hide b99fe
			--hide b99fe,abd6e
			--hide ensembl:ENSG00000124762
			--hide b99fe,ensembl:ENSG00000124762`
  )
  .option(
    "--highlight [color=target1,target2,target3]",
    `Specify entities to highlight.
		To use multiple colors, you can specify multiple "--highlight" options.

		color: hex value or CSS/SVG color keyword
			<https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#Color_keywords>
		target: entity id or typeof value

		If target contains a comma, you must URL encode it, e.g.,
			mytext,moretext => mytext%2Cmoretext

		Examples:
			--highlight red=b99fe
			--highlight ff000=b99fe
			--highlight "#ff000=b99fe"
			--highlight red=b99fe,abd6e
			--highlight red=ensembl:ENSG00000124762
			--highlight red=b99fe,ensembl:ENSG00000124762
			--highlight 66c2a5=b99fe --highlight 8da0cb=ensembl:ENSG00000124762`,
    (s: string, acc) => {
      const [color, targetString] = s.split(/=/);
      acc.push({
        color,
        targets: targetString.split(",").map(decodeURIComponent)
      });
      return acc;
    },
    []
  )
  .action(function(inputPath, outputPath, optionsRaw) {
    const options = defaults(
      {
        static: true,
        hide: [],
        highlight: []
      },
      optionsRaw
    );
    const { static: staticMarkup, hide, highlight } = options;
    const hiddenEntities = arrayify(hide);
    const highlightedEntities = arrayify(highlight).reduce(function(
      acc,
      { color: rawColor, targets }
    ) {
      let color;
      if (Validator.isColor(rawColor)) {
        color = Parser.parseColor(rawColor);
      } else {
        const colorSecondTry = "#" + rawColor;
        if (Validator.isColor(colorSecondTry)) {
          color = Parser.parseColor(colorSecondTry);
        } else {
          throw new Error(
            `
						Could not parse provided highlight color ${rawColor}
						`
          );
        }
      }
      targets.forEach(function(target) {
        acc.push({ target, color: color.hex });
      });
      return acc;
    }, []);

    const render = staticMarkup ? renderToStaticMarkup : renderToString;
    const inputStream = !!inputPath
      ? fs.createReadStream(inputPath)
      : process.stdin;
    const outputStream = !!outputPath
      ? fs.createWriteStream(outputPath)
      : process.stdout;

    hl(inputStream)
      .through(ndjson.parse())
      //      .flatMap(function(input) {
      //        const entitiesWithText = values(input.entityMap).filter(entity =>
      //          entity.hasOwnProperty("textContent")
      //        );
      //        const fontFamilies = compact(
      //          uniq(
      //            entitiesWithText.map(
      //              (entity: Record<string, any>) => entity.fontFamily
      //            )
      //          )
      //        );
      //
      //        /* this was an older version
      //        return hl(nodeTextSizer.loadWrapprMap(fontFamilies)).map(function(
      //          wrapprMap
      //        ) {
      //          entitiesWithText.forEach(function(entity: Record<string, any>) {
      //            const {
      //              fontFamily,
      //              fontSize,
      //              textContent,
      //              width,
      //              padding
      //            } = entity;
      //            var lines = wrapprMap[fontFamily].wrap(
      //              textContent,
      //              fontSize,
      //              width - padding
      //            );
      //            console.log("lines");
      //            console.log(lines);
      //          });
      //
      //          return input;
      //        });
      //				//*/
      //
      //        return hl(
      //          nodeTextSizer.loadOpentypeLayoutMap(fontFamilies)
      //        ).map(function(opentypeLayoutMap) {
      //          entitiesWithText.forEach(function(entity: Record<string, any>) {
      //            const {
      //              fontFamily,
      //              fontSize,
      //              textContent,
      //              width,
      //              padding
      //            } = entity;
      //            console.log(`trying to use opentypeLayoutMap[${fontFamily}]`);
      //            console.log(opentypeLayoutMap);
      //            var lines = opentypeLayoutMap[fontFamily](textContent, {
      //              //fontSize,
      //              width: width - padding
      //            });
      //            console.log("lines");
      //            console.log(lines);
      //          });
      //
      //          return input;
      //        });
      //      })
      .map(function(input) {
        return render(
          React.createElement(
            Diagram,
            {
              customStyle,
              edgeDrawerMap,
              filterDrawerMap,
              Icons,
              markerDrawerMap,
              pathway: input.pathway,
              entityMap: input.entityMap,
              /*
              id: input.pathway.id,
              backgroundColor: input.pathway.backgroundColor,
              height: input.pathway.height,
              name: input.pathway.height,
              width: input.pathway.width,
							//*/
              highlightedEntities,
              hiddenEntities
            },
            null
          )
        );
      })
      .errors(function(err) {
        console.error("err");
        console.error(err);
        process.exitCode = 1;
      })
      .pipe(outputStream);
  })
  .on("--help", function() {
    console.log(`
			Examples:

			Convert Kaavio-formatted JSON into SVG:
			$ kaavio json2svg WP100.json WP100.svg

			Convert streaming:
			$ cat WP100.json | kaavio json2svg > WP100.svg

			Convert streaming w/ pretty output:
      $ cat ../bulk-gpml2pvjson/unified/WP100.json | ./bin/kaavio json2svg | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml
			`);
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

/*
./bin/kaavio json2svg ./WP4.json 
cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/kaavio json2svg > output.svg
//*/
