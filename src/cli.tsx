import "source-map-support/register";

import * as fs from "fs";
import * as fse from "fs-extra";
import * as ndjson from "ndjson";
import * as path from "path";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { DOMParser } from "xmldom";
import * as JSONStream from "JSONStream";
import { Base64 } from "js-base64";

/*
import {
  assign
} from "lodash/fp";
//*/

import {
  assign,
  camelCase,
  curry,
  compact,
  filter,
  intersection,
  isArray,
  isEmpty,
  isFinite,
  isString,
  keys,
  flow,
  fromPairs,
  forOwn,
  omitBy,
  partition,
  toPairs,
  union,
  uniq,
  upperFirst,
  values
} from "lodash";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Observable } from "rxjs/Observable";
import { AjaxRequest } from "rxjs/observable/dom/AjaxObservable";
import "rxjs/add/observable/dom/ajax";
import "rxjs/add/observable/from";
import "rxjs/add/observable/fromPromise";
import "rxjs/add/observable/pairs";
import "rxjs/add/observable/of";
import "rxjs/add/operator/toArray";
import "rxjs/add/operator/toPromise";
import "rxjs/add/operator/do";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import * as isVarName from "is-valid-var-name";

// TODO why doesn't "import * as name" work with Webpack for the following packages?
//import * as hl from "highland";
const hl = require("highland");
//import * as program from "commander";
const program = require("commander");
//import * as urlRegex from "url-regex";
const urlRegex = require("url-regex");
//import * as getit from "getit";
const getit = require("getit");
//import * as validDataUrl from "valid-data-url";
const validDataUrl = require("valid-data-url");

import { Diagram } from "./components/Diagram";
//import * as edgeDrawers from "./drawers/edges/index";
// Are the icons and markers are specific to Pvjs (less likely to useful to other applications)?
// Should they be part of Kaavio?
import * as markerDrawers from "./drawers/markers";

const npmPackage = require("../package.json");
const exec = hl.wrapCallback(require("child_process").exec);

const BUILTIN_ICONS_DIR = path.join(__dirname, "../src/drawers/icons/");
const ICONS_BUNDLE_PATH = path.join(
  BUILTIN_ICONS_DIR,
  "__bundled_dont_edit__.tsx"
);

const readdir = hl.wrapCallback(fs.readdir);
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

function get(inputPath, opts = {}) {
  const strippedPath = inputPath.replace("file://", "");
  return hl.wrapCallback(getit)(strippedPath, opts);
}

/*
function build() {
  console.log("Rebuilding Kaavio (may take some time)...");
  return exec("npm run build:lib", {
    // NOTE: we want to build from the top level of the package
    // __dirname is kaavio/src/, even after compilation
    // we want either kaavio/ or else PKG-DEPENDING-ON-KAAVIO/
    cwd: path.join(__dirname, "..")
  })
    .last()
    .doto(x => console.log("Build complete."));
}
//*/

function build() {
  console.log("Rebuilding Kaavio (may take some time)...");
  const webpackProdConfigPath = path.resolve(
    __dirname,
    "../webpack.prod.config.js"
  );
  return exec(`webpack --config ${webpackProdConfigPath}`, {
    // NOTE: we want to build from the top level of the package
    // __dirname is kaavio/src/, even after compilation
    // we want either kaavio/ or else PKG-DEPENDING-ON-KAAVIO/
    cwd: path.join(__dirname, "..")
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

const bundleEdges = bundleBySelectiveImport("edges");
const bundleMarkers = bundleBySelectiveImport("markers");

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
          return get(input).through(JSONStream.parse()).map(function(iconMap) {
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
  const [
    typeStyleFileInputs,
    nonTypeStyleFileInputs
  ] = partition(strippedInputs, strippedInput =>
    strippedInput.match(/\.style.tsx$/)
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
          const suggestedFillOnlyCSS = keys(iconMap)
            .map((key, i) => `.Icon.${key} {fill: currentColor; stroke: none;}`)
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
									return <g dangerouslySetInnerHTML={{
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
  icons: bundleIcons,
  markers: bundleMarkers,
  edges: bundleEdges,
  styles: bundleStyles
};

const STRING_TO_BOOLEAN = {
  true: true,
  false: false
};

program
  .command("bundle <whatToBundle> [input...]")
  .option(
    "-b, --build <boolean>",
    `Automatically rebuild after bundling so changes take effect. Default: true.`,
    (s: string) => s === "true"
  )
  .option(
    "-p, --preserve-aspect-ratio [comma-separated list or boolean]",
    `
		Freeze icon aspect ratio to original value.

		true: applies to all icons
		list: applies to the icon(s) with the specified name(s)

		If this option is specified without a value, the value is set to true`,
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

    const drawerDir = path.join(__dirname, `../src/drawers/${whatToBundle}/`);
    const bundlePath: string = path.join(
      drawerDir,
      `__bundled_dont_edit__.tsx`
    );

    const bundler = bundlerMap[whatToBundle];

    readFile(bundlePath)
      .errors(function(err) {
        err.message = err.message || "";
        err.message += `for bundle ${whatToBundle} (${JSON.stringify(inputs)})`;
        throw err;
      })
      .each(function(bundle) {
        const bundlerStream = bundler(inputs, {
          preserveAspectRatio
        }).errors(function(err) {
          console.error(err);
          fs.writeFile(bundlePath, bundle, function(err) {
            if (!!err) {
              throw err;
            }
            // TODO if we throw an error, is process.exit needed?
            //process.exit(1);
          });
        });

        console.log("bundlePath");
        console.log(bundlePath);
        bundlerStream.observe().last().each(function(x) {
          console.log(`Successfully bundled ${whatToBundle}.`);
          if (buildAutomatically) {
            build()
              .errors(function(err) {
                console.error(err);
                process.exit(1);
              })
              .last()
              .each(function(x) {
                process.exit(0);
              });
          } else {
            console.log(
              `Rebuild Kaavio to make changes take effect: npm run build`
            );
            // TODO I don't seem to be able to get the process to both finish
            // piping the the bundlePath and to also quit, unless I use this
            // kludge with the timeout and process.exit.
            setTimeout(function() {
              process.exit(0);
            }, 500);
          }
        });

        bundlerStream.pipe(fs.createWriteStream(bundlePath));
      });
  })
  .on("--help", function() {
    console.log(`
			<whatToBundle> can be one of these: ${keys(bundlerMap).join(", ")}

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
				--preserve-aspect-ratio=wikidata:Q218642,Mitochondria

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
				--preserve-aspect-ratio=wikidata:Q218642,Mitochondria

cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | jq -c '(. | .entityMap[] | select(.dbId == "HMDB00161")) as {id: $id} | .entityMap[$id].drawAs |= "wikidata:Q218642" | .entityMap[$id].height=81' | ./bin/kaavio json2svg --static true | sed 's/\[\]$//' > output.svg

cat ../bulk-gpml2pvjson/wikipathways-20170910-json-Homo_sapiens-unified/WP106.json | jq -c '(. | .entityMap[] | select(has("wikidata"))) as {id: $id, width: $width, wikidata: $wikidata} | .entityMap[$id].drawAs |= $wikidata | .entityMap[$id].height |= $width' | ./bin/kaavio json2svg --static true | sed 's/\[\]$//' > output.svg

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
  .action(function(inputPath, outputPath, options) {
    const staticMarkup = options.hasOwnProperty("static")
      ? options.static
      : true;
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
              pathway: input.pathway,
              id: input.pathway.id,
              backgroundColor: input.pathway.backgroundColor,
              entityMap: input.entityMap,
              height: input.pathway.height,
              name: input.pathway.height,
              width: input.pathway.width,
              zIndices: input.pathway.contains
              //filters,
              //highlightedNodes,
              //hiddenEntities
            },
            null
          )
        );
      })
      .errors(function(err) {
        console.error(err);
        process.exit(1);
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

// TODO does the process exit on its own?
//process.exit(0);

program.parse(process.argv);

// If no command is specified, output help.
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/*
./bin/kaavio json2svg ./WP4.json 
cat ../gpml2pvjson-js/test/input/playground.gpml | ../gpml2pvjson-js/bin/gpml2pvjson | ./bin/kaavio json2svg > output.svg
//*/
