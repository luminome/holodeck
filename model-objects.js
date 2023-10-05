import { vec2, vec3 } from "gl-matrix";
import { setAttrs } from "./main";
import { _set_buffer, _get_buffer } from "./projector.js";


// 📌 object type;
const g_square_path = (index, projector) => {
    const z = 0.0;
    const verts = new Float32Array([
      -1,1,z,
      1,1,z,
      1,-1,z,
      -1,-1,z
    ]).map((v) => v *= 2);
  
    const update = () => {
      const c = ['a','b','c','d'].map((s,i) => projector.project(_get_buffer(verts,i)));
      const d = `M${c[0]} L${c[1]} L${c[2]} L${c[3]}z`;
      setAttrs(P.svg_item,{d:d});
    }
  
    const make_path_svg = () => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      setAttrs(g,{
        'data-index': P.index,
      });
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      setAttrs(p,{
        'opacity': '0.5',
      });
      return [g, p];
    }
  
    const init = () => {
      [P.svg, P.svg_item] = make_path_svg();
      P.svg.appendChild(P.svg_item);
      return P;
    }
  
    const P = {
      name: undefined,
      index: index,
      loc: vec3.create(),
      px_loc: vec2.create(),
      z_index: undefined,
      base_siz: 8.0,
      base_color: 'blue',
      init,
      update
    }
  
    return P;
  }
  
  // 📌 object type;
  const g_point = (index) => {
  
    const make_point_svg = () => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      setAttrs(g,{
        'id':`grid-${P.index.toString().padStart(2,'0')}`,
        'data-index': P.index
      });
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      setAttrs(t,{
        fill: 'black',
        'dominant-baseline': 'middle',
        'text-anchor': 'middle'
      });
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      return [g, c, t];
    }
  
    const init = () => {
      [P.svg, P.svg_item, P.svg_text] = make_point_svg();
      P.svg.appendChild(P.svg_item);
      P.svg.appendChild(P.svg_text);
      return P;
    }
  
    const P = {
      name: undefined,
      type: 'point',
      index: index,
      loc: vec3.create(),
      px_loc: vec2.create(),
      z_index: undefined,
      base_siz: 8.0,
      base_color: 'white',
      init
    }
  
    return P;
  }
  
  export { g_point, g_square_path }