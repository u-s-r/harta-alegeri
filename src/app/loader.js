import d3 from 'd3';

export const show = () => {
  d3.select('.loader').classed('dn', false);
}

export const hide = () => {
  d3.select('.loader').classed('dn', true);
}
