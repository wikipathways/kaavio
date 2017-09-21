import * as React from "react";
import * as ReactDom from "react-dom";
import { highlighter } from "../filters/highlighter";
import { Text } from "./Text";
import { Node } from "./Node";
import { EntityProps } from "../typings";
import { Group } from "./Group";
import { Edge } from "./Edge";
import { getHighlighted } from "../utils/getHighlighted";
import { getHidden } from "../utils/getHidden";
import { normalizeElementId } from "../utils/normalizeElementId";
import ReactCSSTransitionGroup from "react-addons-css-transition-group";

/**
 * Parent Entity component.
 * Most components share many properties so we "lift state up" to the parent.
 */
export class Entity extends React.Component<any, any> {
  constructor(props: EntityProps) {
    super(props);
  }

  // TODO check that rotation is rendering correctly
  renderText() {
    const {
      width,
      height,
      id,
      textContent,
      fontFamily,
      fontSize,
      fontStyle,
      fontWeight,
      textAlign,
      color
    } = this.props;
    if (!textContent) return;

    return (
      <Text
        id={`text-for-${id}`}
        key={`text-for-${id}`}
        className="textlabel"
        textContent={textContent}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        textAlign={textAlign}
        color={color}
        width={width}
        height={height}
      />
    );
  }

  // TODO look at other code and determine whether to render Burrs as Entities
  renderBurrs() {
    const {
      burrs,
      drawAs,
      entityMap,
      width,
      height,
      kaavioType,
      edgeDrawers,
      points,
      backgroundColor,
      mergedStyle,
      highlightedNodes,
      hiddenEntities
    } = this.props;
    if (!burrs || burrs.length < 1) return;
    const parentNormalizedDrawAs = normalizeElementId(drawAs);

    return burrs
      .map(burrId => entityMap[burrId])
      .map(burr => {
        // NOTE: notice side effect
        burr.width += 0;
        burr.height += 0;
        const attachmentDisplay = burr.attachmentDisplay;
        const position = attachmentDisplay.position;
        const offset = attachmentDisplay.hasOwnProperty("offset")
          ? attachmentDisplay.offset
          : [0, 0];

        // kaavioType is referring to the entity the burr is attached to
        if (["SingleFreeNode", "Group"].indexOf(kaavioType) > -1) {
          burr.x = width * position[0] - burr.width / 2 + offset[0];
          burr.y = height * position[1] - burr.height / 2 + offset[1];
        } else if (kaavioType === "Edge") {
          // TODO get edge logic working so we can position this better
          // TODO look at current production pvjs to see how this is done
          const positionXY = new edgeDrawers[parentNormalizedDrawAs](
            points
          ).getPointAtPosition(position[0]);
          burr.x = positionXY.x - burr.width / 2 + offset[0];
          burr.y = positionXY.y - burr.height / 2 + offset[1];
        } else {
          throw new Error(
            `Cannot handle burr with parent of type ${kaavioType}`
          );
        }

        return burr;
      })
      .map(burr => {
        // Even though burr.kaavioType = "Node", we render the Burr as a new Entity.
        // If we just render it a Node, we can't do things like individually highlighting the burr.
        const highlighted = getHighlighted(burr, highlightedNodes);
        const hidden = getHidden(burr, hiddenEntities);
        return (
          <Entity
            key={burr.id}
            {...burr}
            edgeDrawers={edgeDrawers}
            backgroundColor={backgroundColor}
            mergedStyle={mergedStyle}
            isHighlighted={highlighted.highlighted}
            highlightedColor={highlighted.color}
            highlightedNodes={highlightedNodes}
            entityMap={entityMap}
            hiddenEntities={hiddenEntities}
            hidden={hidden}
          />
        );
      });
  }

  render() {
    const {
      rotation,
      width,
      height,
      type,
      id,
      x,
      y,
      color,
      kaavioType,
      customClass,
      isHighlighted,
      highlightedColor,
      hidden
    } = this.props;
    let entityTransform;
    if (x || y || rotation) {
      entityTransform = `translate(${x},${y})`;
      if (rotation) {
        entityTransform += ` rotate(${rotation},${width / 2},${height / 2})`;
      }
    }

    // Anders: I think it's best to be explicit. Instead of using components[kaavioType] do this.
    // I know it's a bit redundant but in this case I think it aids comprehension
    let child;
    switch (kaavioType) {
      case "SingleFreeNode":
        child = <Node {...this.props} />;
        break;
      case "Burr":
        child = <Node {...this.props} />;
        break;
      case "Edge":
        child = <Edge {...this.props} />;
        break;
      case "Group":
        child = <Group {...this.props} />;
        break;
      default:
        throw new Error(
          "The Kaavio type of " +
            kaavioType +
            " does not exist. Please use one of " +
            "SingleFreeNode, Edge, or Group."
        );
    }

    return (
      <g
        id={id}
        key={id}
        className={customClass}
        color={color}
        visibility={hidden ? "hidden" : "visible"}
        transform={entityTransform}
        typeof={type.join(" ")}
        filter={
          isHighlighted
            ? "url(#" + highlighter(id, highlightedColor).url + ")"
            : null
        }
      >
        {/*
        // NOTE: recommendation is to only use one metadata child per element,
				// so if we want multiple RDFa property/content pairs, we could use <g>:
        // https://www.w3.org/TR/SVG/metadata.html#MetadataElement
        <g
          property="biopax:entityReference"
          content="identifiers:ec-code/3.6.3.14"
        />
				// alternatively, we could use regular RDF inside a metadata element:
				<metadata>
					<rdf:RDF
							 xmlns:rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
							 xmlns:rdfs = "http://www.w3.org/2000/01/rdf-schema#"
							 xmlns:dc = "http://purl.org/dc/elements/1.1/" >
						<rdf:Description about="http://example.org/myfoo"
								 dc:title="MyFoo Financial Report"
								 dc:description="$three $bar $thousands $dollars $from 1998 $through 2000"
								 dc:publisher="Example Organization"
								 dc:date="2000-04-11"
								 dc:format="image/svg+xml"
								 dc:language="en" >
							<dc:creator>
								<rdf:Bag>
									<rdf:li>Irving Bird</rdf:li>
									<rdf:li>Mary Lambert</rdf:li>
								</rdf:Bag>
							</dc:creator>
						</rdf:Description>
					</rdf:RDF>
				</metadata>
				*/}
        {isHighlighted
          ? <defs>
              {/*Define any SVG definitions that apply to the whole entity. Filters etc. */}
              {highlighter(id, highlightedColor).filter}
            </defs>
          : null}

        {child}

        {this.renderBurrs()}

        {this.renderText()}
      </g>
    );
  }
}
