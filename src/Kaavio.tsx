import "source-map-support/register";
import * as React from "react";
import { Diagram } from "./components/Diagram";
import { PanZoom } from "./components/PanZoom";

/**
 * Kaavio component.
 * This is the highest component in Kaavio. All states are handled here and passed down as props to other components.
 *
 * You may pass an onReady(kaavio) function to this. This will be called with the Kaavio reference when everything is
 * rendered. You can access the manipulation API via kaavio.manipulator
 */
export class Kaavio extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      diagramRef: null
    };
  }

  onPanZoomReady = panZoom => {
    // Fire the onReady function with a reference to Kaavio
    const { onReady } = this.props;
    onReady(this);
  };

  handleClick = e => {
    const { onEntityClick } = this.props;
    const entity = e.entity;
    if (onEntityClick && entity) onEntityClick(entity);
  };

  render() {
    const {
      customStyle,
      filters,
      entities,
      name,
      width,
      height,
      highlightedEntities,
      hiddenEntities,
      zoomedEntities,
      pannedEntities,
      zoomLevel,
      panCoordinates,
      onPanZoomChange,
      showPanZoomControls = true,
      panZoomLocked = false
    } = this.props;

    const backgroundColor = customStyle.backgroundColor || "white";
    const id = "kaavio-container";

    // This is a port to the legacy use of node_id
    // TODO: Change all references of highlightedNodes to the new highlightedEntities
    const highlightedEntitiesLegacy = highlightedEntities
      ? highlightedEntities.map(singleHighlightedEntity => {
          return {
            node_id: singleHighlightedEntity.entityId,
            color: singleHighlightedEntity.color
          };
        })
      : [];

    const entityMap = entities.reduce(function(acc, entity) {
      acc[entity.id] = entity;
      return acc;
    }, {});

    const zIndices = entities
      .sort(function(a: any, b: any) {
        if (a.zIndex > b.zIndex) {
          return 1;
        } else if (a.zIndex < b.zIndex) {
          return -1;
        } else {
          return 0;
        }
      })
      .map(entity => entity.id);

    // TODO: Don't use refs!
    // Accessing the diagram ref from the state is a little bit of a hack to get panZoom working.
    // Consider refactoring the panZoom to be truly Reactive and not use refs
    return (
      <div id={id} className={`kaavio-container ${customStyle.containerClass}`}>
        <Diagram
          ref={diagram =>
            !this.state.diagramRef && this.setState({ diagramRef: diagram })}
          id={`kaavio-diagram-for-${id}`}
          name={name}
          width={width}
          height={height}
          backgroundColor={backgroundColor}
          entityMap={entityMap}
          filters={filters}
          handleClick={this.handleClick}
          zIndices={zIndices}
          customStyle={customStyle}
          highlightedNodes={highlightedEntitiesLegacy}
          hiddenEntities={hiddenEntities}
        />
        <PanZoom
          diagram={this.state.diagramRef}
          zoomLevel={zoomLevel}
          panCoordinates={panCoordinates}
          zoomedEntities={zoomedEntities}
          pannedEntities={pannedEntities}
          onChange={onPanZoomChange}
          locked={panZoomLocked}
          onReady={this.onPanZoomReady}
          showPanZoomControls={showPanZoomControls}
        />
      </div>
    );
  }
}