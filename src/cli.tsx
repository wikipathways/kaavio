import "source-map-support/register";
import * as fs from "fs";
import * as fse from "fs-extra";
import * as hl from "highland";
import * as path from "path";
import * as ndjson from "ndjson";
import * as program from "commander";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import * as xpath from "xpath";
import { DOMParser } from "xmldom";
import * as urlRegex from "url-regex";
import * as getit from "getit";
import * as JSONStream from "JSONStream";
import { Base64 } from "js-base64";
import {
  assign,
  camelCase,
  curry,
  compact,
  defaults,
  find,
  filter,
  intersection,
  isEmpty,
  keys,
  flow,
  fromPairs,
  forOwn,
  omitBy,
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
import * as validDataUrl from "valid-data-url";
import * as isVarName from "is-valid-var-name";
import { Diagram } from "./components/Diagram";
import * as edgeDrawers from "./drawers/edges/index";
// Are the icons and markers are specific to Pvjs (less likely to useful to other applications)?
// Should they be part of Kaavio?
import * as markerDrawers from "./drawers/markers";
import * as customStyle from "./drawers/style/custom.style";
const npmPackage = require("../package.json");
const exec = hl.wrapCallback(require("child_process").exec);

const ICONS_DIR = path.join(__dirname, "../src/drawers/icons/");
const ICONS_BUNDLE_PATH = path.join(ICONS_DIR, "__bundled_dont_edit__.tsx");

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

function build() {
  console.log("Rebuilding project (may take some time)...");
  return exec("npm run build", {
    // NOTE: we want to build from the top level of the package
    // __dirname is kaavio/src/, even after compilation
    // we want either kaavio/ or else PKG-DEPENDING-ON-KAAVIO/
    cwd: path.join(__dirname, "..")
  }).doto(x => console.log("Build complete."));
}

const compileBySelectiveImport = curry(function(name, inputs) {
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

  const compiledDrawerCode =
    ` import "source-map-support/register";
    export ${whatToImport} from "./index";
		` + "\n";

  /*
  build()
    .errors(function(err) {
      console.error(err);
      process.exit(1);
    })
    .each(function(x) {});
	//*/

  return hl([compiledDrawerCode]);
});

const compileEdges = compileBySelectiveImport("edges");
const compileMarkers = compileBySelectiveImport("markers");

function getIconMap(inputs: string[]) {
  return readdir(ICONS_DIR).flatMap(function(filenames) {
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
              [input]: `file://${ICONS_DIR}${input}.svg#${input}`
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
          return get(input).through(JSONStream.parse());
        }
      })
      .reduce1(function(acc, iconMap) {
        return assign(acc, iconMap);
      });
  });
}

function compileIcons(inputs) {
  const iconStream = getIconMap(inputs)
    .flatMap(function(iconMap) {
      console.log("Importing:");
      return hl
        .pairs(iconMap)
        .flatMap(function([name, iconPath]) {
          console.log(`  ${name} from ${iconPath}`);
          const iconPathComponents = iconPath.split("#");
          const url = iconPathComponents[0];
          const id = iconPathComponents[1];
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
              // TODO check this
              svgStringStream = get(strippedPath);
              /*
							svgStringStream = get(strippedPath, {
								cwd: path.dirname(inputPath)
							});
							//*/
            }
          }

          return svgStringStream.map(function(svgString) {
            var doc = new DOMParser().parseFromString(svgString);
            var node = !id
              ? doc
              : (node = xpath.select(`//*[@id='${id}']`, doc)[0]);
            node.setAttribute("id", name);
            return node.toString();
          });
        })
        .collect()
        .map(function(svgStrings) {
          const joinedSvgString = svgStrings.join("").replace(/[\r\n]/g, "");
          return (
            `import "source-map-support/register";
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
      err.message += ` in compileIcons(${JSON.stringify(inputs)})`;
      push(err);
    });

  return iconStream;
}

const compilerMap = {
  icons: compileIcons,
  markers: compileMarkers,
  edges: compileEdges
};

program
  .command("compile <whatToCompile> [input...]")
  .action(function(whatToCompile, inputs: string[]) {
    console.log(`Compiling ${whatToCompile}...`);

    if (!compilerMap.hasOwnProperty(whatToCompile)) {
      const cmdSuggestions = keys(compilerMap)
        .map(key => `\tkaavio compile ${key} ${inputs.join(", ")}`)
        .join("\r\n");
      throw new Error(
        `"${whatToCompile}" is not a supported whatToCompile option. Supported options: \r\n${cmdSuggestions}\r\n`
      );
    }

    const drawerDir = path.join(__dirname, `../src/drawers/${whatToCompile}/`);
    const bundlePath: string = path.join(
      drawerDir,
      `__bundled_dont_edit__.tsx`
    );

    const compiler = compilerMap[whatToCompile];

    readFile(bundlePath)
      .errors(function(err) {
        err.message = err.message || "";
        err.message += `for compile ${whatToCompile} (${JSON.stringify(
          inputs
        )})`;
        throw err;
      })
      .each(function(bundle) {
        const compilerStream = compiler(inputs).errors(function(err) {
          console.error(err);
          fs.writeFile(bundlePath, bundle, function(err) {
            if (!!err) {
              throw err;
            }
            //process.exit(1);
          });
        });

        compilerStream.observe().each(function(x) {
          console.log(`Successfully compiled ${whatToCompile}.`);
          console.log(
            `Rebuild kaavio to make changes take effect:\n\r  npm run build`
          );
        });

        compilerStream.pipe(fs.createWriteStream(bundlePath));
      });
  })
  .on("--help", function() {
    console.log();
    console.log(
      `  <whatToCompile> can be one of these: ${keys(compilerMap).join(", ")}`
    );
    console.log();
    console.log("  Examples:");
    console.log();
    console.log("    Compile markers (include all available):");
    console.log("    $ kaavio compile markers");
    // also allowed:
    //console.log("    $ kaavio compile markers '*'");
    console.log();
    console.log("    Compile markers (include only selected):");
    console.log("    $ kaavio compile markers Arrow TBar");
    console.log();
    console.log("    Compile icons (include all available):");
    console.log("    $ kaavio compile icons");
    console.log();
    console.log("    Compile icons from JSON icon map file:");
    console.log(
      "    $ kaavio compile icons ./src/drawers/icons/defaultIconMap.json"
    );
    console.log();
    console.log("    Compile edges (include all available):");
    console.log("    $ kaavio compile edges");
    console.log();
    console.log("    Compile edges (include only selected):");
    console.log(
      "    $ kaavio compile edges StraightLine CurvedLine ElbowLine SegmentedLine"
    );
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
        return (
          render(
            React.createElement(
              Diagram,
              {
                pathway: input.pathway,
                id: input.pathway.id,
                backgroundColor: input.pathway.backgroundColor,
                entityMap: input.entityMap,
                //filters,
                height: input.pathway.height,
                name: input.pathway.height,
                width: input.pathway.width,
                zIndices: input.pathway.contains,
                //highlightedNodes,
                //hiddenEntities
                customStyle: customStyle,
                edgeDrawers: edgeDrawers
              },
              null
            )
          ) + "\n"
        );
      })
      .errors(function(err) {
        console.error(err);
        process.exit(1);
      })
      .map(x => String(x))
      .pipe(outputStream);
  })
  .on("--help", function() {
    console.log();
    console.log("  Examples:");
    console.log();
    console.log("    Convert Kaavio-formatted JSON into SVG:");
    console.log("    $ kaavio json2svg WP100.json WP100.svg");
    console.log();

    console.log("    Convert streaming:");
    console.log("    $ cat WP100.json | kaavio json2svg > WP100.svg");
    console.log();
    console.log("    Convert streaming w/ pretty output:");
    console.log(
      "    $ cat ../bulk-gpml2pvjson/unified/WP100.json | ./bin/kaavio json2svg | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml"
    );
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
