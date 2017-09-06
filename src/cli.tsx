#!/usr/bin/env node

var _ = require("lodash");
var fs = require("fs");
var Diagram = require("./components/Diagram").Diagram;
var hl = require("highland");
var path = require("path");
var npmPackage = require("../package.json");
var ndjson = require("ndjson");
var program = require("commander");
var React = require("react");
var ReactDOM = require("react-dom");
import { renderToString } from "react-dom/server";
import edgeDrawers from "./components/EdgeDrawers";
// Are the icons and markers are specific to Pvjs (less likely to useful to other applications)?
// Should they be part of Kaavio?
import markerDrawers from "./MarkerDrawers";
import icons from "./icons/main";

//var VError = require("verror");

program
  .version(npmPackage.version)
  .description("Converts Kaavio-formatted JSON to SVG");
/*
  .option(
    "--mysampleoption [string]",
    'Instructions for my sampleoption'
  );
  //*/

program.on("--help", function() {
  console.log("  Examples:");
  console.log();
  console.log("    Convert Kaavio-formatted JSON into SVG:");
  console.log(
    "    $ kaavio ../../bulk-gpml2pvjson/unified/WP100.json WP100.svg"
  );
  console.log();
  console.log("    Convert streaming:");
  console.log(
    "    $ cat ../../bulk-gpml2pvjson/unified/WP100.json | kaavio  > ./WP100.svg"
  );
  console.log();
  console.log("    Convert streaming w/ pretty output:");
  console.log(
    "cat ../bulk-gpml2pvjson/unified/WP100.json | ./bin/kaavio | xmllint --pretty 2 - | pygmentize -O encoding=UTF-8 -l xml"
  );
});

program.parse(process.argv);

var id = program.id;

var source = hl(process.stdin).through(ndjson.parse());

//*
source
  .map(function(input) {
    //var output = renderToString(<App />);
    var output = renderToString(
      React.createElement(
        Diagram,
        {
          entities: _.values(input.entityMap),
          entityMap: input.entityMap,
          zIndices: input.pathway.contains,
          customStyle: {},
          edgeDrawers: edgeDrawers,
          markerDrawers: markerDrawers,
          icons: {}
        },
        null
      )
    );
    //console.log("output");
    //console.log(output);
    return output + "\r\n";
    /*
    var kaavio = new Diagram(input);
    console.log("kaavio");
    console.log(kaavio);
    return renderToString(kaavio);
    //*/
  })
  .errors(function(err) {
    console.error(err);
    process.exit(1);
  })
  .map(x => String(x))
  .pipe(process.stdout);
//*/

/*
hl(source).map(x => hl([x])).each(function(jsonStream) {
  var kaavio = new Diagram();
  console.log("kaavio");
  console.log(kaavio);

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
