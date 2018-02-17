import * as React from "react";
import * as ReactDom from "react-dom";
import { omit, pick, reduce, upperFirst } from "lodash/fp";
import { Text } from "../spinoffs/Text";
import { Node } from "./Node";
import { Group } from "./Group";
import { Edge } from "./Edge";
import ReactCSSTransitionGroup from "react-addons-css-transition-group";
import { formatClassNames } from "../utils/formatClassNames";
import { EntityProps, StringReferenceValue } from "../types";

/**
 * Parent Entity component.
 * Most components share many properties so we "lift state up" to the parent.
 */
export class Entity extends React.Component<any, any> {
  constructor(props: EntityProps) {
    super(props);
  }

  renderText() {
    const { props } = this;
    const { id, textContent, textRotation, type } = props;
    if (!textContent) return;

    const textPropsToPassDown = [
      "color",
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontWeight",
      "height",
      "lineHeight",
      "overflow",
      "padding",
      "textAlign",
      "textContent",
      // Note: not including "textRotation", because we want to
      // pass it down as just "rotation"
      "textOverflow",
      "verticalAlign",
      "whiteSpace",
      "width"
    ];
    const containerPropsToPassDown = ["id"];
    const seed = pick(textPropsToPassDown, props);
    const propsToPassDown = reduce(
      function(acc, containerPropName) {
        const propName = "container" + upperFirst(containerPropName);
        acc[propName] = props[containerPropName];
        return acc;
      },
      seed,
      containerPropsToPassDown
    );

    return (
      <Text
        id={`${id}-text`}
        key={`${id}-text`}
        rotation={textRotation}
        {...propsToPassDown}
      />
    );
  }

  renderBurrs() {
    const { props } = this;
    const {
      burrs,
      drawAs: parentDrawAs,
      theme,
      entityMap,
      createChildProps,
      height,
      kaavioType,
      points,
      width
    } = props;

    if (!burrs || burrs.length < 1) return;

    return burrs
      .map(burrId => entityMap[burrId])
      .map(burr => {
        // NOTE: notice side effect
        burr.width += 0;
        burr.height += 0;
        const attachmentDisplay = burr.attachmentDisplay;
        const [xPositionScalar, yPositionScalar] = attachmentDisplay.position;
        const [xOffset, yOffset] = "offset" in attachmentDisplay
          ? attachmentDisplay.offset
          : [0, 0];

        // kaavioType is referring to the entity the burr is attached to
        if (["SingleFreeNode", "Group"].indexOf(kaavioType) > -1) {
          burr.x = width * xPositionScalar - burr.width / 2 + xOffset;
          burr.y = height * yPositionScalar - burr.height / 2 + yOffset;
        } else if (kaavioType === "Edge") {
          // TODO get edge logic working so we can position this better
          // TODO look at current production pvjs to see how this is done
          const edgeDrawer = new theme[parentDrawAs](points);
          const positionXY = new theme[parentDrawAs](points).getPointAtPosition(
            xPositionScalar
          );
          burr.x = positionXY.x - burr.width / 2 + xOffset;
          burr.y = positionXY.y - burr.height / 2 + yOffset;
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
        return <Entity key={burr.id} {...createChildProps(props, burr)} />;
      });
  }

  componentWillReceiveProps(nextProps) {
    // TODO handle this
  }

  render() {
    const { props } = this;
    const {
      fill,
      borderStyle,
      strokeWidth,
      color,
      className,
      createChildProps,
      drawAs,
      height,
      id,
      kaavioType,
      parentFill,
      rotation,
      textContent,
      type,
      width,
      x,
      y
    } = props;

    const childProps = omit("className", props);

    let entityTransform;
    if (x || y || rotation) {
      entityTransform = `translate(${x},${y})`;
      if (rotation) {
        entityTransform += ` rotate(${rotation},${width / 2},${height / 2})`;
      }
    }

    let child;
    const kaavioTypeToComponentMap = {
      SingleFreeNode: Node,
      Burr: Node,
      Edge: Edge,
      Group: Group
    };
    const KaavioComponent = kaavioTypeToComponentMap[kaavioType];
    if (!!KaavioComponent) {
      child = <KaavioComponent {...childProps} />;
    } else {
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
        about={id}
        className={formatClassNames(type, kaavioType, className)}
        color={color}
        name={textContent}
        transform={entityTransform}
        typeof={type.map(encodeURI).join(" ")}
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

        {child}

        {this.renderBurrs()}

        {this.renderText()}
      </g>
    );
  }
}
