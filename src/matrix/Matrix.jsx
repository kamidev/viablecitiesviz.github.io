import React, { Component } from 'react';
import { select, axisLeft, axisTop, event, scalePoint, easePolyOut } from 'd3';
import { themeLabel, focusLabel, packData, buildScaleData, parseNewlinesY, parseNewlinesX, type2class } from './MatrixUtility';
import AnimatedInfoBox from '../info-box/AnimatedInfoBox';
import MatrixTooltip from './MatrixTooltip';
import PropTypes from 'prop-types';
import isEqual from 'react-fast-compare';
import debounce from 'lodash.debounce';
import './Matrix.css';

const masterTransition = (transition) => transition.duration(800).ease(easePolyOut.exponent(4));

class Matrix extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hoveredProject: null,
      clickedProject: null
    };

    this.margin = { top: 150, right: 20, bottom: 20, left: 180 };
    this.offset = { x: 0,  y: 0 };
    this.draw = this.draw.bind(this);
  }

  componentDidMount() {
    this.svg = select(this.svgRef);

    // used for transforming the contents of the svg, if necessary
    this.svgInner = this.svg
      .append('g')
        .classed('matrix-svg-inner', true);

    this.scaleX = scalePoint()
        .domain([1,2,3,4])
        .padding(0.5)
    this.scaleY = scalePoint()
        .domain([1,2,3,4,5])
        .padding(0.5)

    // y-axis
    this.svgInner.append('g')
        .classed('matrix-y-axis', true);

    // themes label
    this.svgInner.append('text')
        .classed('themes-label', true)
        .classed('matrix-axis-label', true)
        .text('Teman');

    // x-axis
    this.svgInner.append('g')
        .classed('matrix-x-axis', true);

    // focus areas label
    this.svgInner.append('text')
        .classed('focus-areas-label', true)
        .classed('matrix-axis-label', true)
        .text('Fokusområden');

    // make some circles
    this.circles = this.svgInner.append('g').classed('circles', true);

    this.draw(true);

    // clear clickedProject when clicking outside of any circle
    // TODO, put this on something bigger than the svg?
    this.svg.on('click', () => {
      if (event.target.tagName !== 'circle') {
        this.setState({
          clickedProject: null
        });
      }
    });

    this.debounce = debounce(() => this.draw(), 100);
    window.addEventListener('resize', this.debounce);
  }

  componentDidUpdate(prevProps, prevState) {
    this.updateHovered(this.state.hoveredProject, prevState.hoveredProject);
    this.updateClicked(this.state.clickedProject, prevState.clickedProject);

    if (!isEqual(this.props.filteredData, prevProps.filteredData)) {
      this.updateData(this.props.filteredData);
      this.setState({
        clickedProject: null,
        hoveredProject: null
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.debounce);
    this.svg.on('click', null);
  }

  draw(init = false) {
    let height = +this.svgWrapperRef.clientHeight - this.margin.top - this.margin.bottom;
    let width = +this.svgWrapperRef.clientWidth - this.margin.left - this.margin.right;

    // 300 px is the size of the infobox that appears when a project is clicked!
    if (this.state.clickedProject !== null) width -= 300;
    
    const stretch = false;
    if (!stretch) {
      const aspectRatio = 5 / 5; // 4 / 5 is "optimal"
      const optimalHeight = width * 1 / aspectRatio;
      const optimalWidth = height * aspectRatio;

      if ((optimalHeight + this.margin.top + this.margin.bottom) <= this.svgWrapperRef.clientHeight) {
        this.offset = { x: 0, y: (height - optimalHeight) / 2 };
        height = optimalHeight;
      } else {
        this.offset = { x: (width - optimalWidth) / 2, y: 0 };
        width = optimalWidth;
      }
    }

    // update scales
    this.scaleX.range([0, width]);
    this.scaleY.range([0, height]);

    // set up selectors
    const selectors = {
      svgInner: this.svgInner,
      yAxis: this.svgInner.select('g.matrix-y-axis'),
      themesLabel: this.svgInner.select('text.themes-label'),
      xAxis: this.svgInner.select('g.matrix-x-axis'),
      focusAreasLabel: this.svgInner.select('text.focus-areas-label')
    }
    if (!init)
      Object.keys(selectors).forEach(s => selectors[s] = selectors[s].transition().call(masterTransition));

    selectors.svgInner
        .attr('transform', `translate(${this.offset.x}, ${this.offset.y})`);

    // themes label
    selectors.themesLabel
        .attr('transform', `translate(30, ${this.margin.top + height / 2})rotate(-90)`);

    // focus areas label
    selectors.focusAreasLabel
        .attr('transform', `translate(${this.margin.left + width / 2}, ${this.margin.top - 110})`);

    /**
     * NOTE: The default text elements (labels) on the axes are hidden and replaced to
     * allow for two things: (1) splitting up the labels into multiple lines and (2)
     * having transitions. The default labels can support (1) and (2) separately but not 
     * at the same time! So that's why there's some extra code here
     *
     * We don't want remove the original text element and .domain,
     * if we remove the text element, d3-axis will start fucking with our label
     * (changin text contents, position etc)
     * if we remove .domain, d3-axis will just add it again next draw call.
     */

    // (equivalent to axis.tickPadding [but hardcoded])
    const tickPadding = 20;

    // y-axis
    selectors.yAxis
        .attr('transform', `translate(${width + this.margin.left}, ${this.margin.top})`)
        .call(axisLeft(this.scaleY).tickSize(width))
    const yAxisSelection = selectors.yAxis.selection ? selectors.yAxis.selection() : selectors.yAxis;
    if (yAxisSelection.selectAll('.tick text.label').empty()) {
      yAxisSelection
          .call(e => e.selectAll('.tick text').attr('display', 'none'))
          .call(e => e.select('.domain').attr('display', 'none'))
        .selectAll('.tick')
        .append('text')
          .classed('label', true)
          .text(i => themeLabel[i])
          .attr('fill', 'currentColor')
          .attr('x', -width - tickPadding)
          .attr('dy', '0.32em') // see d3-axis source code
          .call(parseNewlinesY);
    } else {
      const x = -width - tickPadding;
      selectors.yAxis.selectAll('.tick text.label')
          .attr('x', x)
        .selectAll('tspan')
          .attr('x', x);
    }

    // x-axis
    selectors.xAxis
        .attr('transform', `translate(${this.margin.left}, ${height + this.margin.top})`)
        .call(axisTop(this.scaleX).tickSize(height))
    const xAxisSelection = selectors.xAxis.selection ? selectors.xAxis.selection() : selectors.xAxis;
    if (xAxisSelection.selectAll('.tick text.label').empty()) {
      xAxisSelection
          .call(e => e.selectAll('.tick text').attr('display', 'none'))
          .call(e => e.select('.domain').attr('display', 'none'))
        .selectAll('.tick')
        .append('text')
          .classed('label', true)
          .text(i => focusLabel[i])
          .attr('fill', 'currentColor')
          .attr('y', -height - tickPadding)
          .attr('dy', '0em') // see d3-axis source code
          .call(parseNewlinesX);
    } else {
      const y = -height - tickPadding;
      selectors.xAxis.selectAll('.tick text.label')
          .attr('y', y)
          .attr('transform', `translate(0,${y})rotate(-45)translate(0,${-y})`);
    }

    this.updateData(this.props.filteredData);
  }

  updateHovered(current, prev) {
    if (current === prev) return;

    if (prev !== null)
      this.circles.selectAll(`[data-id='${prev.survey_answers.project_id}']`)
          .classed('hover', false);

    if (current !== null)
      this.circles.selectAll(`[data-id='${current.survey_answers.project_id}']`)
          .classed('hover', true);
  }

  updateClicked(current, prev) {
    if (current === prev) return;

    // necessary only if clicking a project changes svgWrapper size (i.e. infobox takes up more space)
    this.draw();

    // clean up from prev
    if (prev !== null) {
      this.svg.classed('clicked', false);
      this.circles.selectAll('.neighbor')
          .classed('neighbor', false);
      this.circles.selectAll('.clicked')
          .classed('clicked', false);
    }

    // make a mess with current
    if (current !== null) {
      let neighborSelector = '';
      current.pins.forEach(pin => {
        neighborSelector += `[data-row='${pin.row}'][data-col='${pin.col}'], `;
      });
      neighborSelector = neighborSelector.slice(0, -2); // remove trailing comma
      this.svg.classed('clicked', true);
      this.circles.selectAll(neighborSelector)
          .classed('neighbor', true);
      this.circles.selectAll(`[data-id='${current.survey_answers.project_id}']`)
          .classed('clicked', true);
    }
  }

  updateData(data) {
    const packedData = packData(data, this.scaleX, this.scaleY);
    this.props.updateScaleData(buildScaleData(packedData));
    const circle = this.circles
      .selectAll('circle')
      .data(packedData, d => `${d.survey_answers.project_id}[${d.row},${d.col}]`);

    circle.exit()
        .on('mouseover', null)
        .on('mouseout', null)
        .on('click', null)
      .transition()
        .call(masterTransition)
        .attr('r', 0)
        .remove();

    circle
      .transition()
        .call(masterTransition)
        .attr('r', d => d.r)
        .attr('transform', d => `translate(${d.x + this.margin.left},${d.y + this.margin.top})`);

    circle.enter().append('circle')
        .attr('transform', d => `translate(${d.x + this.margin.left},${d.y + this.margin.top})`)
        .attr('data-id', d => d.survey_answers.project_id)
        .attr('data-row', d => d.row)
        .attr('data-col', d => d.col)
        .attr('class', d => type2class[d.survey_answers.project_type])
        .on('mouseover', d => this.setState({
          hoveredProject: d
        }))
        .on('mouseout', d => this.setState({
          hoveredProject: null
        }))
        .on('click', d => this.setState({
          clickedProject: d,
          hoveredProject: null
        }))
        .attr('r', 0)
      .transition()
        .call(masterTransition)
        .attr('r', d => d.r);
  }

  render() {
    return (
      <div className="matrix-wrapper">
        <div className="matrix-svg-wrapper" ref={svgWrapper => { this.svgWrapperRef = svgWrapper; }}>
          <svg className="matrix" width="100%" height="100%" ref={svg => { this.svgRef = svg; }} />
          <MatrixTooltip project={this.state.hoveredProject} margin={this.margin} offset={this.offset} />
        </div>
        <AnimatedInfoBox
          data={this.props.data}
          id={this.state.clickedProject !== null ?
            Number.parseInt(this.state.clickedProject.survey_answers.project_id) :
            -1} />
      </div>
    );
  }
}

Matrix.propTypes = {
  data: PropTypes.object.isRequired,
  filteredData: PropTypes.object.isRequired,
  updateScaleData: PropTypes.func.isRequired
};

export default Matrix;
