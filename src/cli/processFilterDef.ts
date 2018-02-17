const select = require("xpath.js");
export function processFilterDef({
  node,
  preserveAspectRatio
}): { node: any; jic: any } {
  //  const attrs = select(node, "//*/@values");
  //  // NOTE: this is now handled by SVGO
  //  for (let i = 0; i < attrs.length; i++) {
  //    const attr = attrs[i];
  //    const values = attr.value;
  //    const updatedValues = values;
  //      .trim()
  //      .replace(/[\r\n]/g, " ")
  //      .replace(/[\ ][\ ]+/g, " ");
  //    if (values !== updatedValues) {
  //      console.warn(`\tWarning: Safari cannot handle untrimmed filter values.
  //    	See https://stackoverflow.com/a/39335132/5354298
  //	Converting:
  //	${values}
  //	to:
  //	${updatedValues}`);
  //      attr.value = updatedValues;
  //    }
  //  }

  /*
    //var nodes = select(node, "//*[local-name(.)='feColorMatrix']");
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
		//*/
  return { node, jic: {} };
}
