import "source-map-support/register";

const fs = require("fs-extra");
import * as ndjson from "ndjson";
const JSONStream = require("JSONStream");
import * as path from "path";
import { DOMParser } from "xmldom";
import { Base64 } from "js-base64";

import {
  assign,
  camelCase,
  //compact,
  curry,
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
const parent = require("parent-package-json");
const program = require("commander");
const urlRegex = require("url-regex");
const validDataUrl = require("valid-data-url");
const VError = require("verror");

import { Diagram } from "./components/Diagram";
import { arrayify } from "./spinoffs/jsonld-utils";

/*
const iconPath = process.env.KAAVIO_ICONS;
if (!iconPath) {
  throw new Error("Missing KAAVIO_ICONS. Please set in .profile.");
}
console.log("iconPath");
console.log(iconPath);
//*/

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
          console.warn("input");
          console.warn(input);
          // User must have specified an icon map saved as a JSON file.
          return (
            get(input)
              .through(JSONStream.parse())
              //.through(ndjson.parse({ strict: false }))
              .map(function(iconMap) {
                console.warn("iconMap");
                console.warn(iconMap);
                return fromPairs(
                  toPairs(iconMap).map(function([key, value]) {
                    if (value.indexOf("http") === 0) {
                      return [key, value];
                    }
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
              })
          );
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
  .option("-o, --out <string>", `Where to save the bundle.`)
  /*
  .option(
    "-o, --out <string>",
    `Where to save the bundle. Default: stdout.`,
    (s?: string) => !s ? process.stdout : fs.createWriteStream(s)
  )
//*/
  .option(
    "-p, --preserve-aspect-ratio [name1,name2,name3...]",
    `Preserve original aspect ratio of icon(s).
		-p: preserve for all icons (notice no value specified)
		-p name1 name2 name3: preserve for the icon(s) with the specified name(s)
		not specified: don't preserve for any icons (all icons stretch to fit their container)`,
    // NOTE: s below is always a string.
    // If the user specifies true, it comes through as a string, not a boolean.
    // If the user doesn't use this option, the function below is not called.
    (s: string) =>
      STRING_TO_BOOLEAN.hasOwnProperty(s) ? STRING_TO_BOOLEAN[s] : s.split(",")
  )
  .action(function(whatToBundle, inputs: string[], options) {
    console.log(`Bundling ${whatToBundle}...`);

    //const outputStream = options.out;

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

    const bundlerStream = bundler(inputs, {
      preserveAspectRatio
    });

    pipeToFilepath(bundlerStream, options.out)
      .flatMap(function() {
        console.log(`Successfully bundled ${whatToBundle}.`);

        console.log(`Rebuild your project to make changes take effect`);
        return hl([]);
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
			$ kaavio bundle markers -o ./src/drawers/MarkerBundle.tsx

			Include only selected built-ins:
			$ kaavio bundle markers Arrow TBar -o ./src/drawers/MarkerBundle.tsx

			################
			# Bundle icons #
			################

			$ kaavio bundle icons Ellipse=./src/drawers/icons/Ellipse.svg -o ./src/drawers/icons/IconBundle.tsx

			You can also use external SVG icons sources, such as:
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

				$ kaavio bundle icons Ellipse=./src/drawers/icons/Ellipse.svg \\
				RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px \\
				-o ./src/drawers/icons/IconBundle.tsx

				Note: the hash and value "#ic_check_box_outline_blank_24px" after the Wikimedia
				URL means we want to use the element with id "ic_check_box_outline_blank_24px"
				from INSIDE the SVG specified by the URL.

			Bundle several icons, setting two of them to retain their original aspect ratios

				$ kaavio bundle icons Brace=https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg \\
				Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg \\
				Mitochondria=http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg \\
				RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px \\
				wikidata:Q218642="http://www.simolecule.com/cdkdepict/depict/bow/svg?smi=CN1C%3DNC2%3DC1C(%3DO)N(C(%3DO)N2C)C" \\
				--preserve-aspect-ratio=wikidata:Q218642 Mitochondria
				-o ./src/drawers/icons/IconBundle.tsx

			Bundle icons as specified in an icon map JSON file:

				$ kaavio bundle icons ./src/drawers/icons/defaultIconMap.json -o ./src/drawers/icons/IconBundle.tsx

			################
			# Bundle edges #
			################

			Include all built-ins:
			$ kaavio bundle edges -o ./src/drawers/EdgeBundle.tsx

			Include only selected built-ins:
			$ kaavio bundle edges StraightLine CurvedLine ElbowLine SegmentedLine -o ./src/drawers/EdgeBundle.tsx
							`);
    // also allowed:
    //console.log("    $ kaavio bundle markers '*'");
    /*
./bin/kaavio bundle icons '*' Brace=https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg Ellipse=~/Downloads/open-iconic-master/svg/aperture.svg Mitochondria=http://smpdb.ca/assets/legend_svgs/drawable_elements/mitochondria-a6d8b51f5dde7f3a99a0d91d35f777970fee88d4439e0f1cacc25f717d2ee303.svg RoundedRectangle=https://upload.wikimedia.org/wikipedia/commons/f/fc/Svg-sprite-toggle.svg#ic_check_box_outline_blank_24px --preserve-aspect-ratio=Mitochondria


./bin/kaavio bundle icons '*' Brace="https://cdn.rawgit.com/encharm/Font-Awesome-SVG-PNG/266b63d5/black/svg/heart-o.svg" \
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
